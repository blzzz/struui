import type { Token, TrackType } from './types.ts';
import { EFFECTS, NOTE_OPS } from './effects.generated.ts';

/**
 * Effekte hängen an einer ganzen Spur, im Code als Methoden nach dem Muster: `s("bd sd").lpf(800).room("<0 .5>")`.
 * Der Wert eines Effekts ist eine Steinliste wie eine Spur, nur liegen Werte statt Klängen darauf.
 * Welche Effekte es gibt, stammt aus Strudels eigener Dokumentation (`effects.generated.ts`), nicht von Hand.
 */
export interface EffectInfo {
  name: string;
  /**
   * `audio` wirkt auf den Klang, `pitch` setzt die Tonhöhe, `midi` geht nur an MIDI-Geräte (`ccv`, `progNum` …).
   * `sample` zerschneidet oder streckt Samples (`chop`, `scrub`, `fit` …), nur in Klangspuren.
   * `arith` rechnet mit den Noten einer Notenspur (`add`, `div` …, siehe `NOTE_OPS`), kein Effekt.
   * Musterbefehle verändern die Ereignisse der ganzen Spur: `pattern` in der Zeit (`fast`, `rev`, `struct`), `random` mit Zufall
   * (`degradeBy`, `shuffle`), `tonal` die Tonhöhe (`transpose`, `scale`).
   */
  group: 'audio' | 'pitch' | 'midi' | 'sample' | 'arith' | 'pattern' | 'random' | 'tonal';
  /** Andere Namen, unter denen Strudel denselben Effekt kennt (`lpf` = `cutoff`). */
  synonyms: string[];
  /** Erster Satz aus Strudels Dokumentation (englisch). */
  description: string;
  /** Was der Wert bedeutet, z. B. `time in seconds`. Kann leer sein. */
  hint: string;
  /** Werte aus Strudels Beispielen, Zahlen aufsteigend. Durch sie schaltet das Einzeltippen. Kann leer sein. */
  values: string[];
  /** Nimmt keinen Wert (`fit`): steht immer als `.fit()` im Code, die Box hat keine Wertreihe. */
  noValue?: true;
  /** Der Wert ist eine Struktur aus Treffern und Pausen (`struct("x ~ x")`): die Box zeigt immer die Wertsteine, keinen Regler. */
  miniOnly?: true;
  /** Startwert einer neuen Box, wenn nicht der mittlere Beispielwert passt (`struct` → `x`, `scale` → `C:major`). */
  start?: string;
  /**
   * Der Wert besteht aus Teilen mit Doppelpunkt, jeder aus einer eigenen Liste: `scale` = Grundton und Tonleiter (`C:minor`,
   * `F#:major:pentatonic`). Die Box zeigt je Teil eine Auswahl, die Wertsteine dürfen Doppelpunkte tragen.
   */
  parts?: string[][];
}

export interface Effect {
  id: string;
  name: string;
  /** Der Wert als Steine. `sound` eines Steins ist hier ein Wert (`800`, `.5`, `a`). Leer = aus, nicht im Code. */
  tokens: Token[];
  /**
   * Bereich des Reglers, in der Box eingestellt («edit»). Gesetzt und der Wert eine einzelne Zahl: im Code Strudels
   * `slider(wert, min, max, step)`. Fehlt er, steht die Zahl allein im Code (`.lpf(800)`). Bei Mini-Notation bleibt er
   * gespeichert, steht aber nicht im Code.
   */
  slider?: SliderRange | null;
  /**
   * Zufallsreihe statt Wert (`RandSeries`): gesetzt, steht sie im Code statt der Wertsteine. Die Steine bleiben erhalten
   * für den Rückweg zu Wertebereich oder Notation.
   */
  rand?: RandSeries | null;
  /** Modulation statt Wert (`ModSeries`): gesetzt, steht sie im Code statt der Wertsteine, wie die Zufallsreihe. */
  mod?: ModSeries | null;
  /** LFO statt Wert (`LfoSeries`): schwingt um einen Mittelwert, steht im Code statt der Wertsteine, wie die Modulation. */
  lfo?: LfoSeries | null;
}

/** Wellenformen für die Modulation: Strudels kontinuierliche Signale von 0 bis 1. */
export const WAVES = ['sine', 'cosine', 'tri', 'saw', 'isaw', 'square', 'perlin'] as const;
export type Wave = (typeof WAVES)[number];

/**
 * Modulation: `sine.range(min, max).segment(segments).slow(slow)`. Eine Welle zwischen min und max, `segments` Stufen
 * pro Zyklus, eine Periode dauert `slow` Zyklen (1 steht nicht im Code). `whole`: dazu `.round()` (`wholeValues`).
 */
export interface ModSeries {
  wave: Wave;
  min: number;
  max: number;
  segments: number;
  slow: number;
  whole: boolean;
}

/** Wellenformen für den LFO: die mit einer Strudel-Fassung von -1 bis 1 (`sine2`), also ohne perlin. */
export const LFO_WAVES = ['sine', 'cosine', 'tri', 'saw', 'isaw', 'square'] as const;
export type LfoWave = (typeof LFO_WAVES)[number];

/**
 * LFO: `sine2.early(phase).mul(depth).add(center).segment(segments).slow(slow)`. Eine Welle von -1 bis 1, um `depth`
 * gestreckt und um `center` verschoben, schwingt also zwischen center - depth und center + depth. `phase` verschiebt sie um
 * einen Teil einer Periode (0 … <1, 0 steht nicht im Code), eine Periode dauert `slow` Zyklen (1 steht nicht im Code),
 * `segments` Stufen pro Periode. `whole`: dazu `.round()` nach `add` (`wholeValues`).
 */
export interface LfoSeries {
  wave: LfoWave;
  center: number;
  depth: number;
  segments: number;
  slow: number;
  phase: number;
  whole: boolean;
}

/**
 * Zufall: `rand.range(min, max).segment(segments).ribbon(offset, cycles)`. Zufallswerte zwischen min und max,
 * `segments` feste Stufen pro Zyklus. Mit `ribbon` wiederholbar: ab `offset` ein Stück von `cycles` Zyklen, immer wieder;
 * ein anderer offset ist eine andere Reihe. Ohne `ribbon` (false) steht `.ribbon()` nicht im Code, offset und cycles
 * bleiben gespeichert. `whole`: dazu `.round()`, ganze Zahlen (`wholeValues`).
 */
export interface RandSeries {
  min: number;
  max: number;
  segments: number;
  offset: number;
  cycles: number;
  ribbon: boolean;
  whole: boolean;
}

/** Die drei Angaben zu Strudels `slider(wert, min, max, step)`. */
export interface SliderRange {
  min: number;
  max: number;
  step: number;
}

export { EFFECTS, NOTE_OPS };

function index(list: readonly EffectInfo[]): Map<string, EffectInfo> {
  const byName = new Map<string, EffectInfo>();
  for (const e of list) for (const n of [e.name, ...e.synonyms]) if (!byName.has(n)) byName.set(n, e);
  return byName;
}
const effectsByName = index(EFFECTS);
const opsByName = index(NOTE_OPS);

/** Auch Synonyme werden gefunden (`cutoff` → `lpf`). */
export function effectInfo(name: string): EffectInfo | undefined {
  return effectsByName.get(name);
}

/**
 * Rechenart für die Noten einer Notenspur (`add`, `sub`, `mul`, `div`). Im Code an der Mini-Notation:
 * `note("c e".add("<0 3>"))`. Strudel rechnet dabei mit MIDI-Zahlen (`c3` = 48). Als Methode nach `note(…)`
 * wirkte `add` nicht auf die Noten, deshalb stehen sie dort.
 */
export function noteOpInfo(name: string): EffectInfo | undefined {
  return opsByName.get(name);
}

/** Beschreibung zu einer Wertreihe, egal ob Effekt oder Rechenart. */
export function valueInfo(name: string): EffectInfo | undefined {
  return effectInfo(name) ?? noteOpInfo(name);
}

/** Startwert eines neuen Effekts: `start`, sonst der mittlere Beispielwert, oder null, wenn Strudel keinen zeigt. */
export function defaultValue(info: EffectInfo): string | null {
  if (info.start !== undefined) return info.start;
  return info.values.length === 0 ? null : info.values[Math.floor((info.values.length - 1) / 2)];
}

const VALUE_WORD = String.raw`(-?(\d+\.?\d*|\.\d+)|-?\d+[A-Za-z]+|[A-Za-z][\w.#]*)`;
const VALUE = new RegExp(`^${VALUE_WORD}$`);
/** Teile nach dem ersten Doppelpunkt: dazu Tonleitern wie `in-sen` und `lydian:#5p:pentatonic`. */
const VALUE_LIST = new RegExp(String.raw`^${VALUE_WORD}(:(${VALUE_WORD}|[\w#][\w.#-]*))*$`);

/**
 * Ein Wert ist ein einzelnes Wort der Mini-Notation: eine Zahl (`800`, `-1`, `.5`), ein Intervall (`3M`, `-2m`) oder ein
 * Name (`a`, `sine`). `list`: auch mehrere Wörter mit Doppelpunkt (`.5:2`, `C:minor`), Strudel macht daraus eine Liste.
 * Nur wo sie gelesen wird (`scrub`, `scale`).
 */
export function isValueAtom(text: string, list = false): boolean {
  return (list ? VALUE_LIST : VALUE).test(text);
}

/**
 * Ein Wert aus Teilen (`EffectInfo.parts`) in `count` Teile: an den ersten Doppelpunkten getrennt, der letzte Teil behält
 * seine (`C:major:pentatonic` → `C`, `major:pentatonic`). Fehlende Teile sind leer.
 */
export function splitParts(value: string, count: number): string[] {
  const parts = value.split(':');
  const head = parts.slice(0, count - 1);
  return [...head, parts.slice(count - 1).join(':'), ...Array<string>(Math.max(0, count - 1 - head.length)).fill('')].slice(0, count);
}

/** Audio-Effekte, die `@strudel/midi` auch für MIDI liest: Strudel schickt `gain × velocity` als Anschlagstärke. */
const MIDI_AUDIO = new Set(['velocity', 'gain']);

/**
 * Was eine Spur anbietet: Klang- und Sampler-Spuren Audio, Tonhöhe und Sample-Funktionen, Notenspuren nur Audio (die Tonhöhe tragen
 * die Steine), MIDI-Spuren MIDI, Tonhöhe und die Anschlagstärke. Musterbefehle in der Zeit und mit Zufall gibt es überall,
 * die für Tonhöhen (`transpose`, `scale`) nur bei Noten- und MIDI-Spuren: Klänge aus `s("…")` haben keine Tonhöhe.
 */
export function offersEffect(type: TrackType, e: EffectInfo): boolean {
  if (e.group === 'pattern' || e.group === 'random') return true;
  if (e.group === 'tonal') return type === 'note' || type === 'midi';
  if (type === 'sound' || type === 'sampler') return e.group === 'audio' || e.group === 'pitch' || e.group === 'sample';
  if (type === 'note') return e.group === 'audio';
  return e.group === 'midi' || e.group === 'pitch' || MIDI_AUDIO.has(e.name);
}

/**
 * Effekte für die Autovervollständigung, nur die zur Art der Spur passenden. Zuerst Namen, die mit der Eingabe beginnen, dann Synonyme,
 * dann Treffer irgendwo im Namen oder in der Beschreibung.
 */
export function searchEffects(query: string, type: TrackType = 'sound', limit = 12): EffectInfo[] {
  return search(
    EFFECTS.filter((e) => offersEffect(type, e)),
    query,
    limit,
  );
}

/**
 * Alle zur Spur passenden Effekte und Befehle einer Kategorie (null = alle), gesucht wie in `searchEffects`.
 * `relative`: Notenspur mit Stufen, die ihre Tonleiter schon hat; dann ohne `scale`.
 */
export function browseEffects(query: string, type: TrackType, category: EffectCategory | null, relative = false): EffectInfo[] {
  return search(
    EFFECTS.filter(
      (e) => offersEffect(type, e) && (category === null || categoryOf(e) === category) && !(relative && e.name === 'scale'),
    ),
    query,
    Infinity,
  );
}

/**
 * Art eines Effekts für die Filter der Effektsuche. Strudel ordnet seine Klangeffekte nicht ein (alle `audio`),
 * deshalb nach Namensregeln: die Familien teilen ein Präfix (`lp…` Tiefpass, `fm…` FM, `room…` Hall).
 * Musterbefehle behalten ihre Gruppe. Was keine Regel trifft, ist `other`.
 */
export const EFFECT_CATEGORIES = [
  'filter',
  'envelope',
  'space',
  'distortion',
  'motion',
  'synth',
  'pitch',
  'level',
  'sample',
  'pattern',
  'random',
  'tonal',
  'midi',
  'arith',
  'other',
] as const;
export type EffectCategory = (typeof EFFECT_CATEGORIES)[number];

/** Regeln für Klangeffekte (`audio`, `pitch`), die erste passende gilt. */
const AUDIO_RULES: [RegExp, EffectCategory][] = [
  [/^(lp|hp|bp)|^(ftype|fanchor|djf|vowel)$/, 'filter'],
  [/^(adsr|attack|decay|sustain|release|clip)$/, 'envelope'],
  [/^(room|delay|ir)/, 'space'],
  [/^(distort|crush|coarse|shape|drive)/, 'distortion'],
  [/^(chorus|phaser|tremolo|vib)/, 'motion'],
  [/^(fm|wt|warp|pw)|^(noise|color|detune|unison|spread|freq)$/, 'synth'],
  [/^(note|octave|penv|pattack|pdecay|prelease|pcurve)$/, 'pitch'],
  [/^(duck)|^(gain|velocity|pan|panchor|busgain|compressor|transient)$/, 'level'],
  [/^(begin|end|loop|loopBegin|loopEnd|speed|cut|stretch|offset)$/, 'sample'],
];

export function categoryOf(info: EffectInfo): EffectCategory {
  if (info.group !== 'audio' && info.group !== 'pitch') return info.group;
  return AUDIO_RULES.find(([re]) => re.test(info.name))?.[1] ?? 'other';
}

/** Rechenarten für Noten, gesucht wie Effekte. */
export function searchNoteOps(query: string, limit = 12): EffectInfo[] {
  return search(NOTE_OPS, query, limit);
}

/** Sucht in einer eigenen Liste wie `searchEffects` (gleiche Rangfolge), z. B. in den sperrbaren Parametern (`browseLockParams`). */
export function search(offered: readonly EffectInfo[], query: string, limit: number): EffectInfo[] {
  const q = query.trim().toLowerCase();
  if (q === '') return offered.slice(0, limit);
  const rank = (e: EffectInfo): number => {
    const name = e.name.toLowerCase();
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (e.synonyms.some((s) => s.toLowerCase().startsWith(q))) return 2;
    if (name.includes(q)) return 3;
    if (e.description.toLowerCase().includes(q)) return 4;
    return -1;
  };
  return offered.map((e) => ({ e, r: rank(e) }))
    .filter(({ r }) => r >= 0)
    .sort((a, b) => a.r - b.r || a.e.name.length - b.e.name.length || a.e.name.localeCompare(b.e.name))
    .slice(0, limit)
    .map(({ e }) => e);
}

/**
 * Nächster Wert nach oben (`dir` 1) oder unten (-1), für die Pfeiltasten beim Bearbeiten eines Wertsteins.
 * Zahlen springen zum nächstgrösseren bzw. -kleineren Beispielwert (am Rand bleibt es dort), Namen schalten im Kreis.
 * Ohne passende Beispielwerte zählen Zahlen in Einer- oder Zehntelschritten.
 * Bei einer Liste (`.5:2`) ändert sich nur das erste Wort, der Rest nach dem Doppelpunkt bleibt.
 */
export function stepValue(current: string, values: readonly string[], dir: 1 | -1): string {
  const colon = current.indexOf(':');
  if (colon >= 0) return stepValue(current.slice(0, colon), values, dir) + current.slice(colon);
  const n = Number(current);
  const numbers = values.filter((v) => /^-?(\d+\.?\d*|\.\d+)$/.test(v));
  if (current.trim() !== '' && !Number.isNaN(n)) {
    if (numbers.length > 0) {
      const next = dir === 1 ? numbers.find((v) => Number(v) > n) : [...numbers].reverse().find((v) => Number(v) < n);
      return next ?? current;
    }
    const step = Number.isInteger(n) ? 1 : 0.1;
    return String(Math.round((n + dir * step) * 1000) / 1000);
  }
  const words = values.filter((v) => !numbers.includes(v));
  if (words.length === 0) return values[0] ?? current;
  const i = words.indexOf(current);
  return words[(i + dir + words.length) % words.length] ?? words[0];
}

const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;

/**
 * Der Wert eines Effekts, wenn er genau ein Stein ohne Zufall und Wiederholung ist (`800`, `sine`), sonst null.
 * Nur dann lässt er sich mit einem Regler bedienen; alles andere ist Mini-Notation und bleibt bei den Wertsteinen.
 */
export function singleValue(tokens: readonly Token[]): string | null {
  if (tokens.length !== 1) return null;
  const t = tokens[0];
  return t.kind === 'sound' && t.random === null && t.repeat === null ? t.sound : null;
}

/**
 * Wie ein Effekt als Regler aussieht. `number`: Schieberegler über `stops` (aufsteigend, mindestens zwei).
 * `words`: Auswahl unter Namen (`vowel` → a, e, i …), wenn Strudels Beispiele keine Zahl zeigen.
 */
export type ValueScale = { kind: 'number'; stops: number[] } | { kind: 'words'; words: string[] };

/**
 * Bereich des Reglers aus Strudels Beispielwerten (Strudel nennt keine Bereiche). Die Beispiele liegen gleichmässig
 * verteilt auf dem Regler, dazwischen linear: so bekommen weite Bereiche wie `lpf` (100 … 8000) unten mehr Platz.
 * Mit nur einem Beispiel reicht der Regler von 0 bis zum Doppelten (bis 1 bei kleinen Werten), ohne Beispiel von 0 bis 1.
 */
export function valueScale(info: EffectInfo | undefined): ValueScale {
  const values = info?.values ?? [];
  const numbers = [...new Set(values.filter((v) => NUMBER.test(v)).map(Number))].sort((a, b) => a - b);
  if (numbers.length === 0 && values.length > 0) return { kind: 'words', words: [...values] };
  if (numbers.length >= 2) return { kind: 'number', stops: numbers };
  const v = numbers[0] ?? 0;
  if (v > 0) return { kind: 'number', stops: [0, v <= 1 ? 1 : 2 * v] };
  if (v < 0) return { kind: 'number', stops: [2 * v, 0] };
  return { kind: 'number', stops: [0, 1] };
}

/** Position eines Werts auf dem Regler, 0 … 1. Werte ausserhalb landen am Rand. */
export function toSlider(value: number, stops: readonly number[]): number {
  const last = stops.length - 1;
  if (value <= stops[0]) return 0;
  if (value >= stops[last]) return 1;
  const i = stops.findIndex((s) => s > value) - 1;
  return (i + (value - stops[i]) / (stops[i + 1] - stops[i])) / last;
}

/** So nah (Anteil des Reglers) rastet er auf einem Beispielwert ein. */
const SNAP = 0.02;

/**
 * Wert an einer Position des Reglers (0 … 1). Nahe einem Beispielwert rastet er dort ein, sonst wird auf etwa
 * ein Hundertstel des Abschnitts gerundet (zwischen 100 und 200 auf Ganze, zwischen 0 und 1 auf Hundertstel).
 */
export function fromSlider(pos: number, stops: readonly number[]): number {
  const last = stops.length - 1;
  const x = Math.min(1, Math.max(0, pos)) * last;
  const near = Math.round(x);
  if (Math.abs(x - near) <= SNAP * last) return stops[near];
  const i = Math.min(Math.floor(x), last - 1);
  const a = stops[i];
  const b = stops[i + 1];
  const raw = a + (x - i) * (b - a);
  const decimals = Math.max(0, -Math.floor(Math.log10((b - a) / 100)));
  return Number(raw.toFixed(decimals));
}

/** Nachkommastellen einer Zahl, wie sie im Code steht (`0.25` → 2). */
function decimalsOf(n: number): number {
  return String(n).split('.')[1]?.length ?? 0;
}

/** Position eines Werts im eingestellten Bereich (`slider()`), 0 … 1, linear. Werte ausserhalb landen am Rand. */
export function toRange(value: number, r: SliderRange): number {
  return Math.min(1, Math.max(0, (value - r.min) / (r.max - r.min)));
}

/** Wert an einer Position (0 … 1) im eingestellten Bereich: auf `step` ab `min` gerundet, nie über `max`. */
export function fromRange(pos: number, r: SliderRange): number {
  const steps = Math.round((Math.min(1, Math.max(0, pos)) * (r.max - r.min)) / r.step);
  const value = Math.min(r.max, r.min + steps * r.step);
  return Number(value.toFixed(Math.max(decimalsOf(r.min), decimalsOf(r.step))));
}

/** Brauchbar als `slider()`: endliche Zahlen, min unter max, Schritt grösser 0. */
export function isSliderRange(r: SliderRange): boolean {
  return [r.min, r.max, r.step].every(Number.isFinite) && r.min < r.max && r.step > 0;
}

/**
 * Vorschlag für den Bereich, bevor er eingestellt ist: von Strudels kleinstem bis grösstem Beispielwert (wie `valueScale`),
 * erweitert um den aktuellen Wert. Der Schritt ist eine runde Zahl um ein Hundertstel des Bereichs (100–8000 → 10).
 */
export function suggestSliderRange(info: EffectInfo | undefined, current: number | null): SliderRange {
  const scale = valueScale(info);
  const stops = scale.kind === 'number' ? scale.stops : [0, 1];
  let min = stops[0];
  let max = stops[stops.length - 1];
  if (current !== null && Number.isFinite(current)) {
    min = Math.min(min, current);
    max = Math.max(max, current);
  }
  return { min, max, step: sliderStep(min, max) };
}

/** Schritt zu einem Bereich: eine runde Zahl um ein Hundertstel davon (100–8000 → 10). Ohne gültigen Bereich 1. */
export function sliderStep(min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 1;
  return 10 ** Math.floor(Math.log10((max - min) / 100));
}

/** Brauchbar als Zufallsreihe: endliche Zahlen, min unter max, Segmente eine ganze Zahl ab 1, Zyklen über 0. */
export function isRandSeries(r: RandSeries): boolean {
  return (
    [r.min, r.max, r.offset, r.cycles].every(Number.isFinite) &&
    r.min < r.max &&
    Number.isInteger(r.segments) &&
    r.segments >= 1 &&
    r.cycles > 0
  );
}

/**
 * Ganze Zahlen für eine Zufallsreihe (`.round()`): wenn min und max ganz sind und alle Beispielwerte aus Strudels
 * Dokumentation auch (`n`, `coarse`; nicht `room` mit `.5`). Ohne Beispielwerte nie.
 */
export function wholeValues(info: EffectInfo | undefined, min: number, max: number): boolean {
  const values = info?.values ?? [];
  return (
    Number.isInteger(min) &&
    Number.isInteger(max) &&
    values.length > 0 &&
    values.every((v) => /^-?\d+$/.test(v.trim()))
  );
}

/** Vorschlag für eine neue Zufallsreihe: der eingestellte Bereich oder der Vorschlag dafür, 4 Segmente, ein Zyklus ab 0. */
export function suggestRandSeries(
  info: EffectInfo | undefined,
  current: number | null,
  range?: SliderRange | null,
): RandSeries {
  const { min, max } = range ?? suggestSliderRange(info, current);
  return { min, max, segments: 4, offset: 0, cycles: 1, ribbon: true, whole: wholeValues(info, min, max) };
}

/** Brauchbar als Modulation: bekannte Welle, endliche Zahlen, min unter max, Segmente ganz ab 1, Dauer über 0. */
export function isModSeries(m: ModSeries): boolean {
  return (
    (WAVES as readonly string[]).includes(m.wave) &&
    [m.min, m.max, m.slow].every(Number.isFinite) &&
    m.min < m.max &&
    Number.isInteger(m.segments) &&
    m.segments >= 1 &&
    m.slow > 0
  );
}

/** Vorschlag für eine neue Modulation: Sinus im eingestellten Bereich (oder dem Vorschlag dafür), 16 Stufen, 4 Zyklen. */
export function suggestModSeries(
  info: EffectInfo | undefined,
  current: number | null,
  range?: SliderRange | null,
): ModSeries {
  const { min, max } = range ?? suggestSliderRange(info, current);
  return { wave: 'sine', min, max, segments: 16, slow: 4, whole: wholeValues(info, min, max) };
}

/** Brauchbar als LFO: bekannte Welle, endliche Zahlen, Tiefe über 0, Segmente ganz ab 1, Dauer über 0, Phase von 0 bis unter 1. */
export function isLfoSeries(l: LfoSeries): boolean {
  return (
    (LFO_WAVES as readonly string[]).includes(l.wave) &&
    [l.center, l.depth, l.slow, l.phase].every(Number.isFinite) &&
    l.depth > 0 &&
    Number.isInteger(l.segments) &&
    l.segments >= 1 &&
    l.slow > 0 &&
    l.phase >= 0 &&
    l.phase < 1
  );
}

/**
 * Vorschlag für einen neuen LFO: Sinus um den Wert (ohne Wert die Mitte des Bereichs), Tiefe ein Viertel des eingestellten
 * Bereichs (oder des Vorschlags dafür), beides auf dessen Schritt gerundet, 16 Stufen, 4 Zyklen, Phase 0.
 */
export function suggestLfoSeries(
  info: EffectInfo | undefined,
  current: number | null,
  range?: SliderRange | null,
): LfoSeries {
  const { min, max } = range ?? suggestSliderRange(info, current);
  const step = sliderStep(min, max);
  const snap = (v: number) => Number((Math.round(v / step) * step).toPrecision(12));
  const center = current ?? snap((min + max) / 2);
  const depth = Math.max(step, snap((max - min) / 4));
  return { wave: 'sine', center, depth, segments: 16, slow: 4, phase: 0, whole: wholeValues(info, center - depth, center + depth) };
}
