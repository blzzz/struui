import { PAUSE, hasModifiers, hasSteps, label } from './types.ts';
import type { Modifiers, Token, TrackType } from './types.ts';
import type { Effect } from './effects.ts';
import { tempoCode } from './tempo.ts';
import type { TempoUnit } from './tempo.ts';

/** Steine zu Strudel-Code. Rein, ohne Abhängigkeit zu Audio oder DOM. */

function suffix(m: Modifiers): string {
  let s = '';
  if (m.repeat) {
    if (m.repeat.op === '*' && m.repeat.value !== 1) s += `*${m.repeat.value}`;
    if (m.repeat.op === '!') s += `!${m.repeat.value}`;
    if (m.repeat.op === '@' && m.repeat.value !== 1) s += `@${m.repeat.value}`;
  }
  if (m.random !== null) s += m.random === 0.5 ? '?' : `?${m.random}`;
  return s;
}

export function tokenToMini(t: Token): string {
  if (t.kind === 'sound' && t.sound === PAUSE) return PAUSE;
  if (hasSteps(t)) return label(t) + (t.steps === null ? '' : `%${t.steps}`);
  return label(t) + (hasModifiers(t) ? suffix(t) : '');
}

/** Wo der Klangname eines Steins im Code steht (Zeichen-Offsets, Ende exklusiv). */
export interface TokenRange {
  tokenId: string;
  start: number;
  end: number;
}

/**
 * Leerzeichen zwischen Steinen, ausser nach `[`/`<` und vor `]`/`>`.
 * `ranges`: Klangnamen und rohe Steine (für das Aufleuchten). `all`: jeder Stein, nur sein Zeichen ohne Modifier (für Fehlerstellen).
 */
export function trackToMiniWithRanges(tokens: readonly Token[]): { text: string; ranges: TokenRange[]; all: TokenRange[] } {
  let text = '';
  let afterOpen = true;
  const ranges: TokenRange[] = [];
  const all: TokenRange[] = [];
  for (const t of tokens) {
    const s = tokenToMini(t);
    if (!(t.kind === 'close' || afterOpen)) text += ' ';
    const range = { tokenId: t.id, start: text.length, end: text.length + label(t).length };
    all.push(range);
    if ((t.kind === 'sound' && t.sound !== PAUSE) || t.kind === 'raw') ranges.push(range);
    text += s;
    afterOpen = t.kind === 'open';
  }
  return { text, ranges, all };
}

export function trackToMini(tokens: readonly Token[]): string {
  return trackToMiniWithRanges(tokens).text;
}

export interface CodeOptions {
  cps: number;
  /** Einheit der Tempozeile im Code. Standard: cps. */
  tempoUnit?: TempoUnit;
  /** Eigene Aufnahmen: Name zu Data-URL (WAV). */
  samples?: ReadonlyMap<string, string>;
  /** Data-URLs für die Anzeige kürzen. Zum Abspielen/Kopieren false lassen. */
  elideSamples?: boolean;
}

export interface Program {
  code: string;
  /** Positionen der Klangnamen im Code. Strudel meldet beim Abspielen Zeichenpositionen, damit lassen sich Steine finden. */
  ranges: TokenRange[];
}

/** Was die Code-Erzeugung von einer Spur braucht. */
export interface CodeTrack {
  tokens: readonly Token[];
  /** Spurname nach dem `$`. Fehlt er, steht nur `$:`. */
  name?: string;
  /** Effekte ohne Wertsteine werden übersprungen. */
  effects?: readonly Pick<Effect, 'name' | 'tokens'>[];
  muted?: boolean;
  /** Lautstärke nach allen Effekten. Fehlt sie oder ist sie 1, steht nichts im Code. Nur bei Klangspuren. */
  volume?: number;
  /** Fehlt sie, ist es eine Klangspur. */
  type?: TrackType;
  /** Notenspur: Rechenarten an der Mini-Notation (`note("c e".add(3))`). Ohne Wertsteine übersprungen. */
  noteOps?: readonly { name: string; tokens: readonly Token[] }[];
  /** Notenspur: Klang der Noten (`.s("sine")`). Ohne Steine steht kein `.s()` im Code. */
  voice?: { readonly tokens: readonly Token[] } | null;
  /** Klangspur: Orbit. Fehlt er oder ist er 1, steht nichts im Code. */
  orbit?: number;
  /** MIDI-Spur: Kanal, Standard 1. */
  channel?: number;
  /** MIDI-Spur: Ausgang. Leer = `.midi()`, Strudel wählt. */
  port?: string;
}

/** Text in einfachen Anführungszeichen, wie Strudels Beispiele (`.midi('IAC Driver Bus 1')`). */
export function quote(text: string): string {
  return `'${text.replace(/[\\']/g, '\\$&')}'`;
}

const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;

/**
 * Ein Effekt als Code, oder null ohne Wertsteine. Ein einzelner Zahlenstein ohne Modifier geht als Zahl hinein (`.lpf(800)`),
 * alles andere als Mini-Notation (`.lpf("<200 800>")`). Dann meldet Strudel auch hier Positionen und die Wertsteine leuchten.
 */
export function effectToCode(e: { name: string; tokens: readonly Token[] }): { text: string; ranges: TokenRange[] } | null {
  const [only] = e.tokens;
  if (!only) return null;
  if (e.tokens.length === 1 && only.kind === 'sound' && NUMBER.test(only.sound) && only.random === null && only.repeat === null) {
    return { text: `.${e.name}(${Number(only.sound)})`, ranges: [] };
  }
  const head = `.${e.name}("`;
  const { text, ranges } = trackToMiniWithRanges(e.tokens);
  return { text: `${head}${text}")`, ranges: shift(ranges, head.length) };
}

const shift = (ranges: readonly TokenRange[], by: number): TokenRange[] =>
  ranges.map((r) => ({ tokenId: r.tokenId, start: r.start + by, end: r.end + by }));

/** Name vor dem Doppelpunkt. Strudel schaltet Muster mit `_` davor stumm und macht jedes `$` eindeutig. */
export function trackLabel(t: Pick<CodeTrack, 'name' | 'muted'>): string {
  return `${t.muted ? '_' : ''}$${t.name ?? ''}`;
}

/** Eine Spur als eine Codezeile (`$drums: s("bd sd").lpf(800)`), mit den Positionen ihrer Klang- und Wertsteine. */
export function trackToCode(t: CodeTrack): { text: string; ranges: TokenRange[] } {
  const { text: mini, ranges: local } = trackToMiniWithRanges(t.tokens);
  let text = `${trackLabel(t)}: ${t.type === 'note' ? 'note' : 's'}("`;
  const ranges = shift(local, text.length);
  text += `${mini}"`;
  // Rechenarten an der Mini-Notation, nicht nach note(…): dort wirkten sie nicht auf die Noten
  for (const op of t.type === 'note' ? (t.noteOps ?? []) : []) {
    const fx = effectToCode(op);
    if (!fx) continue;
    ranges.push(...shift(fx.ranges, text.length));
    text += fx.text;
  }
  text += ')';
  const voice = t.type === 'note' && t.voice ? effectToCode({ name: 's', tokens: t.voice.tokens }) : null;
  if (voice) {
    ranges.push(...shift(voice.ranges, text.length));
    text += voice.text;
  }
  for (const e of t.effects ?? []) {
    const fx = effectToCode(e);
    if (!fx) continue;
    ranges.push(...shift(fx.ranges, text.length));
    text += fx.text;
  }
  if (t.type === 'midi') {
    // `.midi()` am Schluss: es liest die Werte, die alle Aufrufe davor gesetzt haben
    text += `.midichan(${t.channel ?? 1}).midi(${t.port ? quote(t.port) : ''})`;
    return { text, ranges };
  }
  if (t.orbit !== undefined && t.orbit !== 1) text += `.orbit(${t.orbit})`;
  // Am Schluss, damit die Lautstärke der Spur gilt (ein gleichnamiger Effekt davor würde überschrieben)
  if (t.volume !== undefined && t.volume !== 1) text += `.postgain(${t.volume})`;
  return { text, ranges };
}

export function toStrudelProgram(tracks: readonly CodeTrack[], opts: CodeOptions): Program {
  const samples = opts.samples ?? new Map<string, string>();
  const used = new Set<string>();
  for (const { tokens, type, voice } of tracks) {
    // Klangnamen stehen bei Notenspuren in `.s()`, nicht auf den Steinen
    const names = type === 'note' ? (voice?.tokens ?? []) : tokens;
    for (const t of names) if (t.kind === 'sound' && samples.has(t.sound)) used.add(t.sound);
  }
  let code = '';
  if (used.size > 0) {
    const defs = [...used].map((name) => {
      const url = samples.get(name) as string;
      const text = opts.elideSamples
        ? `data:audio/wav;base64,… (${Math.round(url.length / 1024)} kB)`
        : url;
      return `  ${name}: '${text}'`;
    });
    code += `samples({\n${defs.join(',\n')}\n})\n\n`;
  }
  code += `${tempoCode(opts.cps, opts.tempoUnit ?? 'cps')}\n`;
  const ranges: TokenRange[] = [];
  for (const t of tracks) {
    if (t.tokens.length === 0) continue;
    const line = trackToCode(t);
    code += '\n';
    ranges.push(...shift(line.ranges, code.length));
    code += line.text;
  }
  return { code, ranges };
}

export function toStrudelCode(tracks: readonly CodeTrack[], opts: CodeOptions): string {
  return toStrudelProgram(tracks, opts).code;
}
