import { LFO_DEFAULTS, LFO_SHAPES, NOTE_OPS, WAVES, effectInfo, isLfoSeries, isModSeries, isRandSeries, isSliderRange, noteOpInfo, singleValue } from '../domain/effects.ts';
import type { LfoSeries, LfoShape, ModSeries, RandSeries, SliderRange, Wave } from '../domain/effects.ts';
import { LOCKS, isLockParam, isLockValue } from '../domain/locks.ts';
import { SLICES_MAX } from '../domain/sampler.ts';
import type { SamplerMode } from '../domain/sampler.ts';
import { parseScaleName } from '../domain/pitch.ts';
import type { PitchMode, ScaleChoice } from '../domain/pitch.ts';
import { CHANNEL_MAX, ORBIT_MAX, PAUSE, soundToken, trackName } from '../domain/types.ts';
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
 * Paramlocks einer Klangspur stehen nach den Effekten: `s("bd").lpf(800).up("1 .5:4".as("velocity:n"))`.
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
  /** Notenspur: `note("c e")` absolut, `n("0 2").scale("C4:major")` relativ. Bei anderen Spuren `absolute`. */
  pitch: PitchMode;
  /** Relative Notenspur: die Tonleiter aus `.scale(…)`, sonst null. */
  scale: ScaleChoice | null;
  /** Notenspur: die Steine aus `.s(…)`, null ohne `.s()` oder bei anderen Spuren. */
  voice: { tokens: Token[] } | null;
  /** Notenspur: Rechenarten an der Mini-Notation, in ihrer Reihenfolge. */
  noteOps: ValueRow[];
  effects: ValueRow[];
  /** Klangspur: Parameter und Steine aus `.up("…".as("…"))`, sonst null. */
  locks: { params: string[]; tokens: Token[] } | null;
}

/**
 * Ein Effekt oder eine Rechenart: Name, Wertsteine und, aus `slider(wert, min, max, step)`, der Bereich des Reglers.
 * Aus `rand.range(…).segment(…).ribbon(…)` die Zufallsreihe, aus `sine.range(…).segment(…).slow(…)` die Modulation; die
 * Wertsteine sind dann leer. Aus `.lfo({ … })` direkt nach dem Effekt der LFO, die Wertsteine bleiben.
 */
export interface ValueRow {
  name: string;
  tokens: Token[];
  slider: SliderRange | null;
  rand: RandSeries | null;
  mod: ModSeries | null;
  lfo: LfoSeries | null;
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

  /** `.name(` mit beliebigem Leerraum, ohne die Klammer zu lesen. */
  const call = (names: string[]): boolean => {
    space();
    const m = new RegExp(`^\\.\\s*(${names.join('|')})\\s*\\(`).exec(code.slice(pos));
    if (m) pos += m[0].length;
    return m !== null;
  };
  /** Zahl, dann `,` oder (beim letzten) `)`. */
  const arg = (what: string, last = false): number => {
    const n = Number(number(what));
    expect(last ? ')' : ',');
    return n;
  };

  /**
   * Zufallsreihe nach `rand`: `.range(min, max)`, wahlweise `.round()`, dann `.segment(n)` (auch `seg`) und
   * wahlweise `.ribbon(offset, zyklen)` (auch `rib`), in dieser Reihenfolge, so wie `randToCode` sie schreibt.
   * Ohne ribbon gelten Offset 0 und ein Zyklus (gespeichert, nicht im Code).
   */
  const randSeries = (at: number): RandSeries => {
    const shape = 'Eine Zufallsreihe ist rand.range(min, max).segment(n), wahlweise mit .ribbon(offset, zyklen).';
    if (!call(['range'])) throw new CodeError(shape, at);
    const min = arg('Das Minimum');
    const max = arg('Das Maximum', true);
    let whole = false;
    if (call(['round'])) {
      expect(')', '«)», round() nimmt keinen Wert');
      whole = true;
    }
    if (!call(['segment', 'seg'])) throw new CodeError(shape, pos);
    const segments = arg('Die Zahl der Segmente', true);
    const ribbon = call(['ribbon', 'rib']);
    const offset = ribbon ? arg('Der Offset') : 0;
    const cycles = ribbon ? arg('Die Zahl der Zyklen', true) : 1;
    const r = { min, max, segments, offset, cycles, ribbon, whole };
    if (!isRandSeries(r)) {
      throw new CodeError('In der Zufallsreihe liegt das Minimum unter dem Maximum, die Segmente sind ganz ab 1, die Zyklen über 0.', at);
    }
    return r;
  };

  /**
   * Modulation nach der Welle (`sine`): `.range(min, max)`, wahlweise `.round()`, dann `.segment(n)` (auch `seg`) und
   * wahlweise `.slow(zyklen)`, in dieser Reihenfolge, so wie `modToCode` sie schreibt.
   */
  const modSeries = (wave: Wave, at: number): ModSeries => {
    const shape = `Eine Modulation ist ${wave}.range(min, max).segment(n), wahlweise mit .slow(zyklen).`;
    if (!call(['range'])) throw new CodeError(shape, at);
    const min = arg('Das Minimum');
    const max = arg('Das Maximum', true);
    let whole = false;
    if (call(['round'])) {
      expect(')', '«)», round() nimmt keinen Wert');
      whole = true;
    }
    if (!call(['segment', 'seg'])) throw new CodeError(shape, pos);
    const segments = arg('Die Zahl der Segmente', true);
    const slow = call(['slow']) ? arg('Die Dauer in Zyklen', true) : 1;
    const m = { wave, min, max, segments, slow, whole };
    if (!isModSeries(m)) {
      throw new CodeError('In der Modulation liegt das Minimum unter dem Maximum, die Segmente sind ganz ab 1, die Dauer über 0.', at);
    }
    return m;
  };
  const WAVE = new RegExp(`^(${WAVES.join('|')})\\b`);

  /** Strudels Namen für die Angaben eines LFO (`registerSubControls('lfo', …)` in `@strudel/core`), kleingeschrieben. */
  const LFO_KEYS: Record<string, string> = {
    control: 'control', c: 'control', shape: 'shape', sh: 'shape', sync: 'sync', s: 'sync', rate: 'rate', r: 'rate',
    depth: 'depth', dep: 'depth', dr: 'depth', depthabs: 'depthabs', da: 'depthabs', dcoffset: 'dcoffset', dc: 'dcoffset',
    skew: 'skew', sk: 'skew',
  };

  /**
   * LFO nach der öffnenden Klammer von `.lfo(`, für den Effekt `row` davor: `{ control: 'lpf', shape: 'sine', sync: 0.25,
   * depth: 0.5 }`, auch mit Strudels Kurznamen (`c`, `sh`, `s`, `r`, `dep`, `da`, `dc`, `sk`) und Formen als Nummer (0–4).
   * Was fehlt, ist Strudels Vorgabe (`LFO_DEFAULTS`), `.lfo()` allein auch. `control` muss dieser Effekt sein. Liest bis nach `)`.
   */
  const lfoConfig = (row: ValueRow, at: number): LfoSeries => {
    const info = effectInfo(row.name);
    if (!info?.modulatable) throw new CodeError(`.${row.name}() kann Strudels LFO nicht modulieren.`, at);
    if (row.rand || row.mod || !NUMBER.test(singleValue(row.tokens) ?? '')) {
      throw new CodeError(`Ein LFO folgt einem Effekt mit einer Zahl als Wert, z. B. .${row.name}(800).lfo({ … }).`, at);
    }
    const seen = new Map<string, number | string>();
    space();
    if (code[pos] === '{') {
      pos += 1;
      for (space(); code[pos] !== '}'; space()) {
        const keyAt = pos;
        const quoted = /^(["'])(\w+)\1/.exec(code.slice(pos));
        const raw = quoted ? quoted[2] : identifier();
        pos += quoted ? quoted[0].length : 0;
        const key = LFO_KEYS[raw.toLowerCase()];
        if (!key) throw new CodeError(`«${raw}» kann die Box nicht darstellen (möglich: ${[...new Set(Object.values(LFO_KEYS))].join(', ')}).`, keyAt);
        if (seen.has(key)) throw new CodeError(`«${key}» steht zweimal im LFO.`, keyAt);
        expect(':');
        space();
        const text = /^(["'])([^"']*)\1/.exec(code.slice(pos));
        if (text) {
          pos += text[0].length;
          seen.set(key, text[2]);
        } else seen.set(key, Number(number(`«${key}»`)));
        space();
        if (code[pos] === ',') pos += 1;
        else if (code[pos] !== '}') throw new CodeError('Hier fehlt «,» oder «}».', pos);
      }
      pos += 1;
    }
    expect(')');
    if (seen.has('sync') && seen.has('rate')) throw new CodeError('Im LFO steht entweder sync oder rate.', at);
    if (seen.has('depth') && seen.has('depthabs')) throw new CodeError('Im LFO steht entweder depth oder depthabs.', at);
    const control = seen.get('control');
    if (control !== undefined && effectInfo(String(control))?.name !== info.name) {
      throw new CodeError(`Der LFO nach .${row.name}() moduliert nur ihn (control: '${row.name}').`, at);
    }
    let shape: LfoShape = LFO_DEFAULTS.shape;
    const s = seen.get('shape');
    if (typeof s === 'number') {
      if (!Number.isInteger(s) || s < 0 || s >= LFO_SHAPES.length) throw new CodeError(`Die Form des LFO ist 0 bis ${LFO_SHAPES.length - 1}.`, at);
      shape = LFO_SHAPES[s];
    } else if (s !== undefined) {
      const name = s === 'triangle' ? 'tri' : s;
      if (!(LFO_SHAPES as readonly string[]).includes(name)) throw new CodeError(`Unbekannte Form «${s}» (möglich: ${LFO_SHAPES.join(', ')}).`, at);
      shape = name as LfoShape;
    }
    const num = (key: string, fallback: number): number => {
      const v = seen.get(key);
      if (typeof v === 'string') throw new CodeError(`«${key}» ist im LFO eine Zahl.`, at);
      return v ?? fallback;
    };
    const unit = seen.has('sync') ? 'sync' : 'rate';
    const absolute = seen.has('depthabs');
    const l: LfoSeries = {
      shape,
      unit,
      speed: num(unit, LFO_DEFAULTS.speed),
      absolute,
      depth: num(absolute ? 'depthabs' : 'depth', LFO_DEFAULTS.depth),
      dcoffset: num('dcoffset', LFO_DEFAULTS.dcoffset),
      skew: num('skew', LFO_DEFAULTS.skew),
    };
    if (!isLfoSeries(l)) throw new CodeError('Im LFO sind Tempo und Tiefe über 0, skew von 0 bis 1.', at);
    return l;
  };

  /**
   * Wert eines Aufrufs nach der öffnenden Klammer: eine Zahl als ein Stein, Mini-Notation, Strudels Regler
   * `slider(wert, min, max, step)` (fehlen min und max, gilt wie bei Strudel 0 und 1, ohne step ein Hundertstel)
   * eine Zufallsreihe (`randSeries`) oder eine Modulation (`modSeries`). Liest bis nach `)`.
   */
  const value = (name: string): ValueRow => {
    space();
    let tokens: Token[];
    let slider: SliderRange | null = null;
    let rand: RandSeries | null = null;
    let mod: ModSeries | null = null;
    const wave = WAVE.exec(code.slice(pos));
    if (wave) {
      const at = pos;
      pos += wave[0].length;
      mod = modSeries(wave[1] as Wave, at);
      tokens = [];
    } else if (/^rand\b/.test(code.slice(pos))) {
      const at = pos;
      pos += 'rand'.length;
      rand = randSeries(at);
      tokens = [];
    } else if (NUMBER.test(code.slice(pos))) {
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
    return { name, tokens, slider, rand, mod, lfo: null };
  };

  /** Paramlocks nach `.up`: `("1 .5:4".as("velocity:n"))`. Jeder Wert hat höchstens so viele Teile wie Parameter. */
  const lockRow = (): { params: string[]; tokens: Token[] } => {
    const shape = 'Paramlocks sind .up("…".as("parameter:parameter")).';
    expect('(');
    const start = pos;
    const tokens = mini();
    if (!call(['as'])) throw new CodeError(shape, pos);
    space();
    const m = /^(["'])([^"']*)\1/.exec(code.slice(pos));
    if (!m) throw new CodeError(shape, pos);
    const params = m[2].split(':').map((p) => p.trim());
    const unknown = params.find((p) => !isLockParam(p));
    if (unknown !== undefined) throw new CodeError(`«${unknown}» lässt sich nicht sperren (möglich: n, s und Effekte mit einem Wert).`, pos + 1);
    pos += m[0].length;
    expect(')');
    expect(')');
    const bad = tokens.find((t) => t.kind === 'sound' && t.sound !== PAUSE && !isLockValue(t.sound, params.length));
    if (bad?.kind === 'sound') throw new CodeError(`«${bad.sound}» passt nicht zu ${params.length} Parameter${params.length > 1 ? 'n' : ''} (${params.join(':')}).`, start);
    return { params, tokens };
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
    if (fn !== 's' && fn !== 'sound' && fn !== 'note' && fn !== 'n') {
      throw new CodeError('Eine Spur beginnt mit s("…"), note("…") oder n("…").scale("…").', pos - fn.length);
    }
    const relative = fn === 'n';
    const notes = fn === 'note' || relative;
    expect('(');
    const tokens = mini();
    const noteOps: CodeLine['noteOps'] = [];
    for (space(); code[pos] === '.'; space()) {
      pos += 1;
      const at = pos;
      const op = identifier();
      if (!notes) throw new CodeError('Rechnen mit Noten (add, div …) gibt es nur in note(…) und n(…).', at - 1);
      if (!noteOpInfo(op)) throw new CodeError(`Unbekannte Rechenart «${op}» (möglich: ${NOTE_OPS.map((o) => o.name).join(', ')}).`, at);
      expect('(');
      noteOps.push(value(op));
    }
    expect(')');

    // Relative Notenspur: die Tonleiter steht direkt nach n(…), erst sie macht aus den Stufen Noten
    let scale: ScaleChoice | null = null;
    if (relative) {
      space();
      const m = /^\.\s*scale\s*\(\s*(["'])([^"']*)\1\s*\)/.exec(code.slice(pos));
      if (!m) throw new CodeError('Nach n(…) folgt die Tonleiter, z. B. .scale("C4:major").', pos);
      scale = parseScaleName(m[2].trim());
      if (!scale) throw new CodeError(`Unbekannte Tonleiter «${m[2]}» (z. B. C4:major, A3:minor:pentatonic).`, pos + m[0].indexOf(m[2]));
      pos += m[0].length;
    }

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
      if (row.rand) throw new CodeError(`Bei .${mode}() geht keine Zufallsreihe (rand).`, at);
      if (row.mod) throw new CodeError(`Bei .${mode}() geht keine Modulation.`, at);
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
    let locks: CodeLine['locks'] = null;
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
      if (fx === LOCKS) {
        if (notes || sampler) throw new CodeError('Paramlocks (.up) gibt es nur in Klangspuren mit s("…").', at);
        if (locks) throw new CodeError('Die Paramlocks (.up) stehen nur einmal in der Zeile.', at);
        locks = lockRow();
        soundOnly ??= { at, what: '.up()' };
        continue;
      }
      if (notes && fx === 'midi') throw new CodeError('.midi() gibt es nur bei Spuren mit s("…"), nicht mit note("…") oder n("…").', at);
      if (fx === 'lfo') throw new CodeError('Ein LFO (.lfo) folgt direkt dem Effekt, den er moduliert, z. B. .lpf(800).lfo({ … }).', at);
      const special = ['postgain', 'orbit', 'midichan', 'midi'].includes(fx);
      if (!special && !effectInfo(fx)) throw new CodeError(`Unbekannter Effekt «${fx}».`, at);
      expect('(');
      space();
      if (effectInfo(fx)?.noValue) {
        expect(')', `«)», ${fx}() nimmt keinen Wert`);
        effects.push({ name: fx, tokens: [], slider: null, rand: null, mod: null, lfo: null });
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
      const row = value(fx);
      // Strudels LFO direkt danach gehört zu diesem Effekt
      space();
      const lfoAt = pos + 1;
      if (call(['lfo'])) row.lfo = lfoConfig(row, lfoAt);
      effects.push(row);
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
      locks,
      pitch: relative ? 'relative' : 'absolute',
      scale,
    };
  } catch (e) {
    if (e instanceof CodeError) return { ok: false, offset: e.offset, message: e.message };
    throw e;
  }
}
