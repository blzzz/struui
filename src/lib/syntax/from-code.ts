import { NOTE_OPS, effectInfo, noteOpInfo } from '../domain/effects.ts';
import { CHANNEL_MAX, ORBIT_MAX, soundToken, trackName } from '../domain/types.ts';
import type { Token, TrackType } from '../domain/types.ts';
import { textToTokens } from './from-text.ts';

/**
 * Eine ganze Codezeile einer Spur zu Spur und Effekten, die Umkehrung von `trackToCode`:
 * `$drums: s("bd sd").lpf(800).room("<0 .5>")`. Die Mini-Notation darin liest Strudels Grammatik (`textToTokens`).
 * Mehr JavaScript als diese Kette verstehen die Steine nicht; das wird als Fehler mit Stelle gemeldet.
 * Endet die Zeile mit `.midi(…)`, ist es eine MIDI-Spur: `$synth: s("bd").note("c e").midichan(2).midi('IAC')`.
 * Beginnt sie mit `note(…)`, ist es eine Notenspur, ihr Klang steht in `.s(…)`: `$melodie: note("f d").s("sine")`.
 * Rechenarten für die Noten stehen an deren Mini-Notation: `note("f d".add("<0 3>"))`.
 */
export interface CodeLine {
  name: string;
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
  /** Klang- oder Notensteine, je nach `type`. */
  tokens: Token[];
  /** Notenspur: die Steine aus `.s(…)`, null ohne `.s()` oder bei anderen Spuren. */
  voice: { tokens: Token[] } | null;
  /** Notenspur: Rechenarten an der Mini-Notation, in ihrer Reihenfolge. */
  noteOps: { name: string; tokens: Token[] }[];
  effects: { name: string; tokens: Token[] }[];
}

export type CodeResult = ({ ok: true } & CodeLine) | { ok: false; offset: number; message: string };

class CodeError extends Error {
  readonly offset: number;
  constructor(message: string, offset: number) {
    super(message);
    this.offset = offset;
  }
}

export function codeToTrack(code: string): CodeResult {
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

  /** Wert eines Aufrufs nach der öffnenden Klammer: eine Zahl als ein Stein oder Mini-Notation. Liest bis nach `)`. */
  const value = (): Token[] => {
    space();
    const number = /^-?(\d+\.?\d*|\.\d+)/.exec(code.slice(pos));
    let tokens: Token[];
    if (number) {
      pos += number[0].length;
      tokens = [soundToken(number[0])];
    } else {
      tokens = mini();
    }
    expect(')');
    return tokens;
  };

  try {
    space();
    const muted = code[pos] === '_';
    if (muted) pos += 1;
    const labelAt = pos;
    expect('$', '«$» am Anfang (z. B. «$drums:»)');
    const name = identifier();
    if (trackName(name) !== name) throw new CodeError('Der Name darf nur Buchstaben, Ziffern und «_» enthalten, nicht am Ende.', labelAt);
    expect(':');
    space();
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
      noteOps.push({ name: op, tokens: value() });
    }
    expect(')');

    const effects: CodeLine['effects'] = [];
    let volume = 1;
    let orbit = 1;
    let channel = 1;
    let port: string | null = null;
    /** Was nur zu einer Art von Spur passt; erst am Ende bekannt, ob `.midi()` folgt. */
    let soundOnly: { at: number; what: string } | null = null;
    let midiOnly: { at: number; what: string } | null = null;
    let voice: { tokens: Token[] } | null = null;
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
      if (port !== null) throw new CodeError('Nach .midi(…) darf nichts mehr folgen.', pos);
      expect('.');
      const at = pos;
      const fx = identifier();
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
      const number = /^-?(\d+\.?\d*|\.\d+)/.exec(code.slice(pos));
      // `.postgain()` ist der Lautstärkeregler der Spur: nur eine Zahl
      if (fx === 'postgain') {
        if (!number) throw new CodeError('Die Lautstärke (postgain) ist eine Zahl.', pos);
        pos += number[0].length;
        volume = Number(number[0]);
        expect(')');
        soundOnly ??= { at, what: '.postgain()' };
        continue;
      }
      effects.push({ name: fx, tokens: value() });
    }
    const type: TrackType = notes ? 'note' : port === null ? 'sound' : 'midi';
    if (type === 'midi' && soundOnly) throw new CodeError(`${soundOnly.what} gibt es nicht mit .midi().`, soundOnly.at);
    if (type !== 'midi' && midiOnly) throw new CodeError(`${midiOnly.what} gibt es nur mit .midi() am Ende.`, midiOnly.at);
    return { ok: true, name, muted, type, volume, orbit, channel, port: port ?? '', tokens, voice, noteOps, effects };
  } catch (e) {
    if (e instanceof CodeError) return { ok: false, offset: e.offset, message: e.message };
    throw e;
  }
}
