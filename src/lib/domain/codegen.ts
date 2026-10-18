import { PAUSE, hasModifiers, hasSteps, joinsPrevious, label } from './types.ts';
import type { Modifiers, Token, TrackType } from './types.ts';
import { effectInfo } from './effects.ts';
import type { Effect, SliderRange } from './effects.ts';
import { clampSlices } from './sampler.ts';
import type { SamplerMode } from './sampler.ts';
import { splitVariant } from './sounds.ts';
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
 * Leerzeichen zwischen Steinen, ausser nach `[`/`<` und vor `]`/`>`. Ein Stapel (`joinsPrevious`) steht als `[bd, hh]` da.
 * `ranges`: Klangnamen und rohe Steine (für das Aufleuchten). `all`: jeder Stein, nur sein Zeichen ohne Modifier (für Fehlerstellen).
 */
export function trackToMiniWithRanges(tokens: readonly Token[]): { text: string; ranges: TokenRange[]; all: TokenRange[] } {
  let text = '';
  let afterOpen = true;
  const ranges: TokenRange[] = [];
  const all: TokenRange[] = [];
  tokens.forEach((t, i) => {
    const s = tokenToMini(t);
    const joined = joinsPrevious(tokens, i);
    if (joined) text += ', ';
    else if (!(t.kind === 'close' || afterOpen)) text += ' ';
    if (!joined && joinsPrevious(tokens, i + 1)) text += '[';
    const range = { tokenId: t.id, start: text.length, end: text.length + label(t).length };
    all.push(range);
    if ((t.kind === 'sound' && t.sound !== PAUSE) || t.kind === 'raw') ranges.push(range);
    text += s;
    if (joined && !joinsPrevious(tokens, i + 1)) text += ']';
    afterOpen = t.kind === 'open';
  });
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
  /** Eigener Code rund um den Stapel, unverändert ausgegeben. Fehlt er, steht nur der erzeugte Code da. */
  frame?: Frame;
}

/**
 * Eigener Code rund um die Spuren, aus der bearbeiteten Code-Ansicht (`syntax/from-program.ts`). Strudel-Steine versteht ihn
 * nicht, gibt ihn aber unverändert wieder aus: `before` nach Aufnahmen und Tempo, `chain` direkt am Stapel (`.fast(2)`),
 * `after` danach. Im Arrangement hängt `chain` an `arrange(…)`.
 */
export interface Frame {
  before: string;
  chain: string;
  after: string;
}

export const EMPTY_FRAME: Frame = { before: '', chain: '', after: '' };

export interface Program {
  code: string;
  /** Positionen der Klangnamen im Code. Strudel meldet beim Abspielen Zeichenpositionen, damit lassen sich Steine finden. */
  ranges: TokenRange[];
}

/** Was die Code-Erzeugung von einer Spur braucht. */
export interface CodeTrack {
  tokens: readonly Token[];
  /** Spurname, als Kommentar vor der Spur (`/* drums *\/`). Fehlt er, steht kein Kommentar da. */
  name?: string;
  /** Effekte ohne Wertsteine werden übersprungen, ausser solche ohne Wert (`.fit()`). */
  effects?: readonly Pick<Effect, 'name' | 'tokens' | 'slider'>[];
  muted?: boolean;
  /** Lautstärke nach allen Effekten. Fehlt sie oder ist sie 1, steht nichts im Code. Nur bei Klangspuren. */
  volume?: number;
  /** Fehlt sie, ist es eine Klangspur. */
  type?: TrackType;
  /** Notenspur: Rechenarten an der Mini-Notation (`note("c e".add(3))`). Ohne Wertsteine übersprungen. */
  noteOps?: readonly { name: string; tokens: readonly Token[]; slider?: SliderRange | null }[];
  /** Notenspur: Klang der Noten (`.s("sine")`). Ohne Steine steht kein `.s()` im Code. */
  voice?: { readonly tokens: readonly Token[] } | null;
  /** Sampler-Spur: das Sample (`s("brk")`). Ohne Steine (oder null) steht die Spur nicht im Code. */
  sample?: { readonly tokens: readonly Token[] } | null;
  /** Sampler-Spur: `scrub` oder `slice` (Standard), dahinter die Wertsteine der Spur. */
  samplerMode?: SamplerMode;
  /** Sampler-Spur mit `slice`: Zahl der Abschnitte, Standard 8. */
  slices?: number;
  /** Klang- und Sampler-Spur: Orbit. Fehlt er oder ist er 1, steht nichts im Code. */
  orbit?: number;
  /** MIDI-Spur: Kanal, Standard 1. */
  channel?: number;
  /** MIDI-Spur: Ausgang. Leer = `.midi()`, Strudel wählt. */
  port?: string;
  /** Roher Code (`Track.code`): steht so im Stapel, mit Name und `.hush()`. Alles andere gilt dann nicht. */
  code?: string | null;
}

/** Steht die Spur im Code? Nicht ohne Steine, eine Sampler-Spur nicht ohne Sample, roher Code nicht, wenn er leer ist. */
export function inCode(t: CodeTrack): boolean {
  if (t.code != null) return t.code.trim() !== '';
  return t.tokens.length > 0 && (t.type !== 'sampler' || !!t.sample?.tokens.length);
}

/** Text in einfachen Anführungszeichen, wie Strudels Beispiele (`.midi('IAC Driver Bus 1')`). */
export function quote(text: string): string {
  return `'${text.replace(/[\\']/g, '\\$&')}'`;
}

const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;

/**
 * Ein Effekt als Code, oder null ohne Wertsteine. Effekte ohne Wert (`fit`) stehen immer da: `.fit()`. Ein einzelner Zahlenstein ohne Modifier geht als Zahl hinein (`.lpf(800)`),
 * mit eingestelltem Regler als Strudels `slider()` (`.lpf(slider(800, 100, 8000, 10))`, auf strudel.cc ein Regler im Code),
 * alles andere als Mini-Notation (`.lpf("<200 800>")`). Dann meldet Strudel auch hier Positionen und die Wertsteine leuchten.
 */
export function effectToCode(e: {
  name: string;
  tokens: readonly Token[];
  slider?: SliderRange | null;
}): { text: string; ranges: TokenRange[] } | null {
  if (effectInfo(e.name)?.noValue) return { text: `.${e.name}()`, ranges: [] };
  const [only] = e.tokens;
  if (!only) return null;
  if (e.tokens.length === 1 && only.kind === 'sound' && NUMBER.test(only.sound) && only.random === null && only.repeat === null) {
    const n = Number(only.sound);
    const s = e.slider;
    return { text: `.${e.name}(${s ? `slider(${n}, ${s.min}, ${s.max}, ${s.step})` : n})`, ranges: [] };
  }
  const head = `.${e.name}("`;
  const { text, ranges } = trackToMiniWithRanges(e.tokens);
  return { text: `${head}${text}")`, ranges: shift(ranges, head.length) };
}

const shift = (ranges: readonly TokenRange[], by: number): TokenRange[] =>
  ranges.map((r) => ({ tokenId: r.tokenId, start: r.start + by, end: r.end + by }));

/** Der Name als Kommentar vor der Spur (`/* drums *\/ `). Strudel sieht ihn nicht, `codeToTrack` liest ihn wieder. */
export function trackComment(t: Pick<CodeTrack, 'name'>): string {
  return t.name ? `/* ${t.name} */ ` : '';
}

/**
 * Anfang der Zeile einer Sampler-Spur: das Sample, dann die Wertsteine als `scrub` oder `slice`.
 * `/* x *\/ s("brk").slice(8, "0 3 <1 2>")`, `/* x *\/ s("<brk amen>").scrub("0 .25")`.
 */
function samplerHead(t: CodeTrack): { text: string; ranges: TokenRange[] } {
  const sample = trackToMiniWithRanges(t.sample?.tokens ?? []);
  let text = `${trackComment(t)}s("`;
  const ranges = shift(sample.ranges, text.length);
  text += `${sample.text}")`;
  if (t.samplerMode === 'scrub') {
    const fx = effectToCode({ name: 'scrub', tokens: t.tokens });
    if (fx) {
      ranges.push(...shift(fx.ranges, text.length));
      text += fx.text;
    }
    return { text, ranges };
  }
  // slice immer mit Mini-Notation in Anführungszeichen, auch für einen einzelnen Abschnitt
  const values = trackToMiniWithRanges(t.tokens);
  text += `.slice(${clampSlices(t.slices ?? 8)}, "`;
  ranges.push(...shift(values.ranges, text.length));
  text += `${values.text}")`;
  return { text, ranges };
}

/**
 * Eine Spur als eine Codezeile (`/* drums *\/ s("bd sd").lpf(800)`), mit den Positionen ihrer Klang- und Wertsteine.
 * Eine stumme Spur endet mit `.hush()`: Strudel macht daraus Stille, die Zeile bleibt sichtbar.
 */
export function trackToCode(t: CodeTrack): { text: string; ranges: TokenRange[] } {
  if (t.code != null) return { text: `${trackComment(t)}${t.code}${t.muted ? '.hush()' : ''}`, ranges: [] };
  if (t.type === 'sampler') return withTail(t, samplerHead(t));
  const { text: mini, ranges: local } = trackToMiniWithRanges(t.tokens);
  let text = `${trackComment(t)}${t.type === 'note' ? 'note' : 's'}("`;
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
  return withTail(t, { text, ranges });
}

/** Effekte, dann MIDI-Ausgang bzw. Orbit und Lautstärke, zuletzt die Stummschaltung: der gemeinsame Schluss jeder Zeile. */
function withTail(t: CodeTrack, head: { text: string; ranges: TokenRange[] }): { text: string; ranges: TokenRange[] } {
  let { text } = head;
  const ranges = [...head.ranges];
  for (const e of t.effects ?? []) {
    const fx = effectToCode(e);
    if (!fx) continue;
    ranges.push(...shift(fx.ranges, text.length));
    text += fx.text;
  }
  if (t.type === 'midi') {
    // `.midi()` nach allen Werten: es liest die Werte, die alle Aufrufe davor gesetzt haben
    text += `.midichan(${t.channel ?? 1}).midi(${t.port ? quote(t.port) : ''})`;
  } else {
    if (t.orbit !== undefined && t.orbit !== 1) text += `.orbit(${t.orbit})`;
    // Nach den Effekten, damit die Lautstärke der Spur gilt (ein gleichnamiger Effekt davor würde überschrieben)
    if (t.volume !== undefined && t.volume !== 1) text += `.postgain(${t.volume})`;
  }
  if (t.muted) text += '.hush()';
  return { text, ranges };
}

/** Kommt `name` in `code` als ganzes Wort vor (nicht als Teil eines längeren Namens)? */
function mentions(code: string, name: string): boolean {
  const word = /[\p{L}\p{Nd}_$]/u;
  for (let at = code.indexOf(name); at >= 0; at = code.indexOf(name, at + 1)) {
    if (!word.test(code[at - 1] ?? '') && !word.test(code[at + name.length] ?? '')) return true;
  }
  return false;
}

/** Eigene Aufnahmen, die irgendeine Spur braucht, als `samples({…})`, dann die Tempozeile. */
function header(tracks: readonly CodeTrack[], opts: CodeOptions): string {
  const samples = opts.samples ?? new Map<string, string>();
  const used = new Set<string>();
  for (const { tokens, type, voice, sample, code } of tracks) {
    // Roher Code: jede Aufnahme, deren Name darin als Wort vorkommt
    if (code != null) {
      for (const name of samples.keys()) if (mentions(code, name)) used.add(name);
      continue;
    }
    // Klangnamen stehen bei Noten- und Sampler-Spuren in eigenen Reihen, nicht auf den Steinen
    const names = type === 'note' ? (voice?.tokens ?? []) : type === 'sampler' ? (sample?.tokens ?? []) : tokens;
    for (const t of names) {
      // Eine Variante (`rec1:2`) braucht dieselbe Aufnahme
      const name = t.kind === 'sound' ? splitVariant(t.sound).name : '';
      if (samples.has(name)) used.add(name);
    }
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
  return code + `${tempoCode(opts.cps, opts.tempoUnit ?? 'cps')}\n`;
}

/** Alle Spuren in einem `stack(…)`, eine pro Zeile. Null, wenn keine Spur Steine hat. Positionen ab Textanfang. */
function stackCode(tracks: readonly CodeTrack[]): { text: string; ranges: TokenRange[] } | null {
  const lines = tracks.filter(inCode);
  if (lines.length === 0) return null;
  const ranges: TokenRange[] = [];
  let text = 'stack(';
  lines.forEach((t, i) => {
    const line = trackToCode(t);
    text += i === 0 ? '\n  ' : ',\n  ';
    ranges.push(...shift(line.ranges, text.length));
    text += line.text;
  });
  return { text: text + '\n)', ranges };
}

/** Eigener Code vor dem Stapel (`frame.before`), auf eigenen Zeilen. */
function beforeCode(frame: Frame): string {
  return frame.before ? `\n${frame.before}\n` : '';
}

/**
 * Was Strudel spielt, mit dem eigenen Code dahinter: `main` (Stapel oder `arrange(…)`), dann `frame.chain` und `frame.after`.
 * Ohne `main`, aber mit `chain`, steht `silence` da, damit die Aufrufe etwas haben, woran sie hängen.
 */
function mainCode(main: string | null, frame: Frame): string {
  const head = main ?? (frame.chain ? 'silence' : '');
  return (head ? `\n${head}${frame.chain}` : '') + frame.after;
}

/**
 * Der ganze Code: Aufnahmen, Tempo, eigener Code davor, dann alle Spuren in einem `stack(…)`, eine Spur pro Zeile, und eigener
 * Code danach. Ohne Label spielt Strudel den letzten Ausdruck, also diesen Stapel. Ohne Spur mit Steinen steht kein `stack` da.
 */
export function toStrudelProgram(tracks: readonly CodeTrack[], opts: CodeOptions): Program {
  const frame = opts.frame ?? EMPTY_FRAME;
  const code = header(tracks, opts) + beforeCode(frame);
  const stack = stackCode(tracks);
  // Die Positionen zählen ab dem Stapel, nach dem Zeilenumbruch, den `mainCode` davor setzt
  return { code: code + mainCode(stack?.text ?? null, frame), ranges: stack ? shift(stack.ranges, code.length + 1) : [] };
}

/** Eine Szene für das Arrangement: Name der Variable und ihre Spuren. */
export interface CodeScene {
  id: string;
  variable: string;
  tracks: readonly CodeTrack[];
}

/**
 * Arrangement: jede Szene als Variable (`const Szene01 = stack(…)`, ohne Spuren `silence`), dann
 * `arrange([4, Szene01], [2, Szene02])` als letzter Ausdruck. Ohne Abschnitt steht dort `silence`.
 * Positionen nur für die Szene `lit` (die angezeigte): Szenen teilen sich nach dem Kopieren die IDs der Steine.
 */
export function toArrangedProgram(
  scenes: readonly CodeScene[],
  sections: readonly { sceneId: string; times: number }[],
  opts: CodeOptions & { lit?: string },
): Program {
  const frame = opts.frame ?? EMPTY_FRAME;
  let code = header(
    scenes.flatMap((s) => s.tracks),
    opts,
  ) + beforeCode(frame);
  const ranges: TokenRange[] = [];
  for (const s of scenes) {
    const stack = stackCode(s.tracks);
    code += `\nconst ${s.variable} = `;
    if (stack && s.id === opts.lit) ranges.push(...shift(stack.ranges, code.length));
    code += `${stack?.text ?? 'silence'}\n`;
  }
  const variables = new Map(scenes.map((s) => [s.id, s.variable]));
  const parts = sections.flatMap((x) => {
    const v = variables.get(x.sceneId);
    return v ? [`[${x.times}, ${v}]`] : [];
  });
  code += mainCode(parts.length === 0 ? 'silence' : `arrange(\n  ${parts.join(',\n  ')}\n)`, frame);
  return { code, ranges };
}

export function toStrudelCode(tracks: readonly CodeTrack[], opts: CodeOptions): string {
  return toStrudelProgram(tracks, opts).code;
}
