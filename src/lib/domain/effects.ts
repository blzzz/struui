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
   * `arith` rechnet mit den Noten einer Notenspur (`add`, `div` …, siehe `NOTE_OPS`), kein Effekt.
   */
  group: 'audio' | 'pitch' | 'midi' | 'arith';
  /** Andere Namen, unter denen Strudel denselben Effekt kennt (`lpf` = `cutoff`). */
  synonyms: string[];
  /** Erster Satz aus Strudels Dokumentation (englisch). */
  description: string;
  /** Was der Wert bedeutet, z. B. `time in seconds`. Kann leer sein. */
  hint: string;
  /** Werte aus Strudels Beispielen, Zahlen aufsteigend. Durch sie schaltet das Einzeltippen. Kann leer sein. */
  values: string[];
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

/** Startwert eines neuen Effekts: der mittlere Beispielwert, oder null, wenn Strudel keinen zeigt. */
export function defaultValue(info: EffectInfo): string | null {
  return info.values.length === 0 ? null : info.values[Math.floor((info.values.length - 1) / 2)];
}

/** Ein Wert ist ein einzelnes Wort der Mini-Notation: eine Zahl (`800`, `-1`, `.5`) oder ein Name (`a`, `sine`). */
export function isValueAtom(text: string): boolean {
  return /^(-?(\d+\.?\d*|\.\d+)|[A-Za-z][\w.#]*)$/.test(text);
}

/** Audio-Effekte, die `@strudel/midi` auch für MIDI liest: Strudel schickt `gain × velocity` als Anschlagstärke. */
const MIDI_AUDIO = new Set(['velocity', 'gain']);

/**
 * Was eine Spur anbietet: Klangspuren Audio und Tonhöhe, Notenspuren nur Audio (die Tonhöhe tragen die Steine),
 * MIDI-Spuren MIDI, Tonhöhe und die Anschlagstärke.
 */
export function offersEffect(type: TrackType, e: EffectInfo): boolean {
  if (type === 'sound') return e.group !== 'midi';
  if (type === 'note') return e.group === 'audio';
  return e.group !== 'audio' || MIDI_AUDIO.has(e.name);
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

/** Rechenarten für Noten, gesucht wie Effekte. */
export function searchNoteOps(query: string, limit = 12): EffectInfo[] {
  return search(NOTE_OPS, query, limit);
}

function search(offered: readonly EffectInfo[], query: string, limit: number): EffectInfo[] {
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
 */
export function stepValue(current: string, values: readonly string[], dir: 1 | -1): string {
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
  const step = 10 ** Math.floor(Math.log10((max - min) / 100));
  return { min, max, step };
}
