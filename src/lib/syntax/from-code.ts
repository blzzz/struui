import { NOTE_OPS, effectInfo, isSliderRange, noteOpInfo } from '../domain/effects.ts';
import type { SliderRange } from '../domain/effects.ts';
import { SLICES_MAX } from '../domain/sampler.ts';
import type { SamplerMode } from '../domain/sampler.ts';
import { CHANNEL_MAX, ORBIT_MAX, soundToken, trackName } from '../domain/types.ts';
import type { Token, TrackType } from '../domain/types.ts';
import { textToTokens } from './from-text.ts';

/**
 * Eine ganze Codezeile einer Spur zu Spur und Effekten, die Umkehrung von `trackToCode`:
 * `/* drums *\/ s("bd sd").lpf(800).room("<0 .5>")`. Die Mini-Notation darin liest Strudels Grammatik (`textToTokens`).
 * Der Kommentar am Anfang ist der Name; fehlt er, ist der Name leer. `.hush()` ganz am Ende schaltet die Spur stumm.
 * Mehr JavaScript als diese Kette verstehen die Steine nicht; das wird als Fehler mit Stelle gemeldet.
 * Endet die Zeile mit `.midi(…)`, ist es eine MIDI-Spur: `/* synth *\/ s("bd").note("c e").midichan(2).midi('IAC')`.
 * Beginnt sie mit `note(…)`, ist es eine Notenspur, ihr Klang steht in `.s(…)`: `/* melodie *\/ note("f d").s("sine")`.
 * Rechenarten für die Noten stehen an deren Mini-Notation: `note("f d".add("<0 3>"))`.
 * Folgt direkt auf `s("…")` ein `.slice(8, "…")`, ist es eine Sampler-Spur: `/* x *\/ s("brk").slice(8, "0 3")`. Ein `.scrub("…")`
 * an derselben Stelle macht nur dann eine Sampler-Spur, wenn die Spur schon eine ist (`prefer`), sonst ist es ein Effekt.
 */
export interface CodeLine {
  /** Aus dem Kommentar am Anfang (`/* drums *\/`), leer ohne Kommentar. */
  name: string;
  /** Aus `.hush()` am Ende. */
  muted: boolean;
  type: TrackType;
  /** Aus `.postgain(…)`, sonst 1. Nur bei Klangspuren. */
  volume: number;
  /** Aus `.orbit(…)`, sonst 1. Nur bei Klangspuren. */
  orbit: number;
  /** Aus `.midichan(…)`, sonst 1. Nur bei MIDI-Spuren. */
  channel: number;
  /** Aus `.midi('…')`, leer bei `.midi()`. */
  port: string;
  /** Klang-, Noten- oder (Sampler-Spur) Wertsteine, je nach `type`. */
  tokens: Token[];
  /** Sampler-Spur: die Steine aus `s(…)`, sonst null. */
  sample: { tokens: Token[] } | null;
  /** Sampler-Spur: `scrub` oder `slice`. Bei anderen Spuren `slice`, ohne Bedeutung. */
  samplerMode: SamplerMode;
  /** Sampler-Spur mit `slice`: Zahl der Abschnitte. Sonst 8, ohne Bedeutung. */
  slices: number;
  /** Notenspur: die Steine aus `.s(…)`, null ohne `.s()` oder bei anderen Spuren. */
  voice: { tokens: Token[] } | null;
  /** Notenspur: Rechenarten an der Mini-Notation, in ihrer Reihenfolge. */
  noteOps: ValueRow[];
  effects: ValueRow[];
}

/** Ein Effekt oder eine Rechenart: Name, Wertsteine und, aus `slider(wert, min, max, step)`, der Bereich des Reglers. */
export interface ValueRow {
  name: string;
  tokens: Token[];
  slider: SliderRange | null;
}

export type CodeResult = ({ ok: true } & CodeLine) | { ok: false; offset: number; message: string };

class CodeError extends Error {
  readonly offset: number;
  constructor(message: string, offset: number) {
    super(message);
    this.offset = offset;
  }
}

export function codeToTrack(code: string, prefer?: TrackType): CodeResult {
  let pos = 0;
  const space = () => {
    while (pos < code.length && /\s/.test(code[pos])) pos += 1;
  };
  const expect = (text: string, what = `«${text}»`) => {
    space();
    if (!code.startsWith(text, pos)) throw new CodeError(`Hier fehlt ${what}.`, pos);
    pos += text.length;
  };
  const identifier = (): string => {
    const m = /^[\p{L}\p{Nd}_$]*/u.exec(code.slice(pos)) as RegExpExecArray;
    pos += m[0].length;
    return m[0];
  };
  /** Mini-Notation in `"…"` oder `'…'`, als Steine. Fehlerstellen zählen ab Zeilenanfang. */
  const mini = (): Token[] => {
    space();
    const quote = code[pos];
    if (quote !== '"' && quote !== "'") throw new CodeError('Hier fehlt Mini-Notation in Anführungszeichen.', pos);
    const end = code.indexOf(quote, pos + 1);
    if (end < 0) throw new CodeError('Das Anführungszeichen wird nicht geschlossen.', pos);
    const start = pos + 1;
    pos = end + 1;
    const r = textToTokens(code.slice(start, end));
    if (!r.ok) throw new CodeError(r.message, start + r.offset);
    return r.tokens;
  };

  const NUMBER = /^-?(\d+\.?\d*|\.\d+)/;
  /** Eine Zahl, sonst Fehler mit `what`. */
  const number = (what: string): string => {
    space();
    const m = NUMBER.exec(code.slice(pos));
    if (!m) throw new CodeError(`${what} ist eine Zahl.`, pos);
    pos += m[0].length;
    return m[0];
  };

  /**
   * Wert eines Aufrufs nach der öffnenden Klammer: eine Zahl als ein Stein, Mini-Notation, oder Strudels Regler
   * `slider(wert, min, max, step)` (fehlen min und max, gilt wie bei Strudel 0 und 1, ohne step ein Hundertstel). Liest bis nach `)`.
   */
  const value = (name: string): ValueRow => {
    space();
    let tokens: Token[];
    let slider: SliderRange | null = null;
    if (NUMBER.test(code.slice(pos))) {
      tokens = [soundToken(number('Der Wert'))];
    } else if (/^slider\s*\(/.test(code.slice(pos))) {
      const at = pos;
      pos = code.indexOf('(', pos) + 1;
      tokens = [soundToken(number('Der Wert des Reglers'))];
      const rest: number[] = [];
      for (const what of ['Das Minimum', 'Das Maximum', 'Der Schritt']) {
        space();
        if (code[pos] !== ',') break;
        pos += 1;
        rest.push(Number(number(what)));
      }
      expect(')');
      const [min = 0, max = 1] = rest;
      slider = { min, max, step: rest[2] ?? (max - min) / 100 };
      if (!isSliderRange(slider)) throw new CodeError('Im Regler muss das Minimum unter dem Maximum liegen, der Schritt über 0.', at);
    } else {
      tokens = mini();
    }
    expect(')');
    return { name, tokens, slider };
  };

  try {
    space();
    let name = '';
    if (code.startsWith('/*', pos)) {
      const end = code.indexOf('*/', pos + 2);
      if (end < 0) throw new CodeError('Der Kommentar mit dem Namen wird nicht geschlossen («*/»).', pos);
      name = code.slice(pos + 2, end).trim();
      if (trackName(name) !== name) throw new CodeError('Der Name darf nur Buchstaben, Ziffern und «_» enthalten, nicht am Ende.', pos);
      pos = end + 2;
      space();
    } else if (/^_?\$[\p{L}\p{Nd}_]*\s*:/u.test(code.slice(pos))) {
      throw new CodeError('Der Name steht als Kommentar vor der Spur, z. B. «/* drums */ s("bd")».', pos);
    }
    const fn = identifier();
    if (fn !== 's' && fn !== 'sound' && fn !== 'note') {
      throw new CodeError('Eine Spur beginnt mit s("…") oder note("…").', pos - fn.length);
    }
    const notes = fn === 'note';
    expect('(');
    const tokens = mini();
    const noteOps: CodeLine['noteOps'] = [];
    for (space(); code[pos] === '.'; space()) {
      pos += 1;
      const at = pos;
      const op = identifier();
      if (!notes) throw new CodeError('Rechnen mit Noten (add, div …) gibt es nur in note(…).', at - 1);
      if (!noteOpInfo(op)) throw new CodeError(`Unbekannte Rechenart «${op}» (möglich: ${NOTE_OPS.map((o) => o.name).join(', ')}).`, at);
      expect('(');
      noteOps.push(value(op));
    }
    expect(')');

    // Sampler-Spur: `.slice(n, "…")` oder (wenn schon eine) `.scrub("…")` direkt nach s("…")
    let sampler: { mode: SamplerMode; slices: number; tokens: Token[]; at: number } | null = null;
    space();
    const head = notes ? null : /^\.\s*(slice|scrub)\s*\(/.exec(code.slice(pos));
    if (head && (head[1] === 'slice' || prefer === 'sampler')) {
      const at = pos + 1;
      const mode = head[1] as SamplerMode;
      pos += head[0].length;
      let slices = 8;
      if (mode === 'slice') {
        space();
        const m = /^\d+/.exec(code.slice(pos));
        if (!m || Number(m[0]) < 1 || Number(m[0]) > SLICES_MAX) {
          throw new CodeError(`Die Zahl der Abschnitte ist eine ganze Zahl von 1 bis ${SLICES_MAX}.`, pos);
        }
        pos += m[0].length;
        slices = Number(m[0]);
        expect(',');
      }
      const row = value(mode);
      if (row.slider) throw new CodeError(`Bei .${mode}() geht kein Regler (slider).`, at);
      sampler = { mode, slices, tokens: row.tokens, at };
    }

    const effects: CodeLine['effects'] = [];
    let volume = 1;
    let orbit = 1;
    let channel = 1;
    let port: string | null = null;
    /** Was nur zu einer Art von Spur passt; erst am Ende bekannt, ob `.midi()` folgt. */
    let soundOnly: { at: number; what: string } | null = null;
    let midiOnly: { at: number; what: string } | null = null;
    let voice: { tokens: Token[] } | null = null;
    let muted = false;
    /** Ganze Zahl im Bereich, für Orbit und Kanal. */
    const whole = (what: string, max: number): number => {
      space();
      const m = /^\d+/.exec(code.slice(pos));
      if (!m || Number(m[0]) < 1 || Number(m[0]) > max) throw new CodeError(`${what} ist eine ganze Zahl von 1 bis ${max}.`, pos);
      pos += m[0].length;
      expect(')');
      return Number(m[0]);
    };
    for (space(); pos < code.length; space()) {
      if (muted) throw new CodeError('Nach .hush() darf nichts mehr folgen.', pos);
      expect('.');
      const at = pos;
      const fx = identifier();
      // `.hush()` schaltet stumm und steht ganz am Ende, auch nach `.midi(…)`
      if (fx === 'hush') {
        expect('(');
        expect(')', '«)», hush() nimmt keinen Wert');
        muted = true;
        continue;
      }
      if (port !== null) throw new CodeError('Nach .midi(…) folgt höchstens .hush().', at - 1);
      // Bei Notenspuren ist `.s(…)` der Klang der Noten, keine Klangwahl wie bei s("…")
      if (notes && (fx === 's' || fx === 'sound')) {
        if (voice) throw new CodeError('Der Klang (.s) steht nur einmal in der Zeile.', at);
        expect('(');
        voice = { tokens: mini() };
        expect(')');
        continue;
      }
      if (notes && fx === 'midi') throw new CodeError('.midi() gibt es nur bei Spuren mit s("…"), nicht mit note("…").', at);
      const special = ['postgain', 'orbit', 'midichan', 'midi'].includes(fx);
      if (!special && !effectInfo(fx)) throw new CodeError(`Unbekannter Effekt «${fx}».`, at);
      expect('(');
      space();
      if (effectInfo(fx)?.noValue) {
        expect(')', `«)», ${fx}() nimmt keinen Wert`);
        effects.push({ name: fx, tokens: [], slider: null });
        continue;
      }
      if (fx === 'orbit') {
        orbit = whole('Der Orbit', ORBIT_MAX);
        soundOnly ??= { at, what: '.orbit()' };
        continue;
      }
      if (fx === 'midichan') {
        channel = whole('Der MIDI-Kanal', CHANNEL_MAX);
        midiOnly ??= { at, what: '.midichan()' };
        continue;
      }
      // `.midi()` oder `.midi('Ausgang')`: das Gerät, an das die Spur geht
      if (fx === 'midi') {
        port = '';
        const q = code[pos];
        if (q === '"' || q === "'") {
          const m = new RegExp(`^${q}((?:[^\\\\${q}]|\\\\.)*)${q}`).exec(code.slice(pos));
          if (!m) throw new CodeError('Das Anführungszeichen wird nicht geschlossen.', pos);
          port = m[1].replace(/\\(.)/g, '$1');
          pos += m[0].length;
        }
        expect(')');
        continue;
      }
      // `.postgain()` ist der Lautstärkeregler der Spur: nur eine Zahl
      if (fx === 'postgain') {
        volume = Number(number('Die Lautstärke (postgain)'));
        expect(')');
        soundOnly ??= { at, what: '.postgain()' };
        continue;
      }
      effects.push(value(fx));
    }
    const type: TrackType = notes ? 'note' : port !== null ? 'midi' : sampler ? 'sampler' : 'sound';
    if (type === 'midi' && sampler) throw new CodeError(`.${sampler.mode}() direkt nach s(…) gibt es nicht mit .midi().`, sampler.at);
    if (type === 'midi' && soundOnly) throw new CodeError(`${soundOnly.what} gibt es nicht mit .midi().`, soundOnly.at);
    if (type !== 'midi' && midiOnly) throw new CodeError(`${midiOnly.what} gibt es nur mit .midi() am Ende.`, midiOnly.at);
    return {
      ok: true,
      name,
      muted,
      type,
      volume,
      orbit,
      channel,
      port: port ?? '',
      tokens: sampler ? sampler.tokens : tokens,
      voice,
      sample: sampler ? { tokens } : null,
      samplerMode: sampler?.mode ?? 'slice',
      slices: sampler?.slices ?? 8,
      noteOps,
      effects,
    };
  } catch (e) {
    if (e instanceof CodeError) return { ok: false, offset: e.offset, message: e.message };
    throw e;
  }
}
