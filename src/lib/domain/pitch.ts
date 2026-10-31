import { SCALE_STEPS } from './effects.generated.ts';
import { effectInfo } from './effects.ts';
import { toMidi } from './notes.ts';
import type { Token } from './types.ts';

/**
 * Wie eine Notenspur ihre Steine liest. `absolute`: Notennamen oder MIDI-Zahlen (`note("c e g")`).
 * `relative`: Stufen einer Tonleiter (`n("0 2 4").scale("C4:major")`), ganze Zahlen, auch negativ, mit `#`/`b` für Töne
 * zwischen den Stufen (`0#`). Wie Strudel: Grundton plus Intervall der Stufe, je Runde durch die Tonleiter 12 Halbtöne.
 */
export type PitchMode = 'absolute' | 'relative';

/** Tonleiter einer relativen Notenspur: im Code `C4:major` (Grundton, Oktave, Doppelpunkt, Name mit `:` statt Leerzeichen). */
export interface ScaleChoice {
  root: string;
  octave: number;
  type: string;
}

export const DEFAULT_SCALE: ScaleChoice = { root: 'C', octave: 4, type: 'major' };

/** Grundtöne und Tonleitern zur Auswahl, dieselben wie bei der Effekt-Box `scale` (aus `gen:effects`). */
export const SCALE_ROOTS: readonly string[] = effectInfo('scale')?.parts?.[0] ?? ['C'];
export const SCALE_TYPES: readonly string[] = effectInfo('scale')?.parts?.[1] ?? ['major'];
export const SCALE_OCTAVES = [1, 2, 3, 4, 5, 6] as const;

/** Oktave des Grundtons, wenn keine angegeben ist (wie in Strudel). */
const STRUDEL_OCTAVE = 3;

const ROOT = /^([A-Ga-g])([#b]*)(-?\d+)?$/;
const DEGREE = /^(-?\d+)([#b]*)$/;

export function scaleName(s: ScaleChoice): string {
  return `${s.root}${s.octave}:${s.type}`;
}

/** `C4:major`, `Bb:dorian`, `f#3:major:pentatonic`; ohne Oktave 3 wie in Strudel. Null bei unbekanntem Grundton oder Namen. */
export function parseScaleName(text: string): ScaleChoice | null {
  const at = text.indexOf(':');
  if (at < 0) return null;
  const root = ROOT.exec(text.slice(0, at));
  const type = text.slice(at + 1);
  if (!root || !SCALE_STEPS[type]) return null;
  return { root: root[1].toUpperCase() + root[2], octave: root[3] ? Number(root[3]) : STRUDEL_OCTAVE, type };
}

/** Eine Stufe: ganze Zahl, darf negativ sein, mit beliebig vielen `#` oder `b` dahinter. */
export function isDegree(text: string): boolean {
  return DEGREE.test(text.trim());
}

/** Eine Stufe höher (`dir` 1) oder tiefer (-1), für ↑/↓ im Stein. Vorzeichen bleiben. Was keine Stufe ist, bleibt. */
export function stepDegree(current: string, dir: 1 | -1): string {
  const m = DEGREE.exec(current.trim());
  return m ? `${Number(m[1]) + dir}${m[2]}` : current;
}

function offsetOf(accidentals: string): number {
  return [...accidentals].reduce((sum, c) => sum + (c === '#' ? 1 : -1), 0);
}

const SHARPS = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const FLATS = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b'];

function rootMidi(s: ScaleChoice): number | null {
  return toMidi(`${s.root}${s.octave}`);
}

/**
 * Notenname mit Oktave (`eb4`). Mit `b`, wenn der Grundton eines trägt oder die Tonleiter eine kleine, aber keine grosse Terz hat
 * (c-Moll: `eb`, nicht `d#`); sonst mit `#`.
 */
function nameOf(midi: number, s: ScaleChoice): string {
  const steps = SCALE_STEPS[s.type] ?? [];
  const minor = steps.includes(3) && !steps.includes(4);
  const names = s.root.includes('b') || (!s.root.includes('#') && minor) ? FLATS : SHARPS;
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Stufe zu Notenname, wie Strudels `scale`: `2` in `C4:major` ist `e4`, `-1` ist `b3`, `0#` ist `c#4`. Null bei Unbekanntem. */
export function degreeToNote(degree: string, s: ScaleChoice): string | null {
  const m = DEGREE.exec(degree.trim());
  const steps = SCALE_STEPS[s.type];
  const root = rootMidi(s);
  if (!m || !steps || root === null) return null;
  const n = Number(m[1]);
  const round = Math.floor(n / steps.length);
  const index = n - round * steps.length;
  return nameOf(root + 12 * round + steps[index] + offsetOf(m[2]), s);
}

/**
 * Notenname oder MIDI-Zahl zu Stufe, ohne Verlust: liegt die Note zwischen zwei Stufen, die tiefere mit `#`
 * (`c#4` in `C4:major` ist `0#`). Null bei Unbekanntem.
 */
export function noteToDegree(note: string, s: ScaleChoice): string | null {
  const text = note.trim();
  const midi = /^-?\d+$/.test(text) ? Number(text) : toMidi(text);
  const steps = SCALE_STEPS[s.type];
  const root = rootMidi(s);
  if (midi === null || !steps || root === null) return null;
  const rel = midi - root;
  const round = Math.floor(rel / 12);
  const within = rel - 12 * round;
  let index = 0;
  while (index + 1 < steps.length && steps[index + 1] <= within) index += 1;
  return `${round * steps.length + index}${'#'.repeat(within - steps[index])}`;
}

/**
 * Steine einer Notenspur in die andere Lesart umrechnen (beim Umschalten absolut ↔ relativ). Pausen, Klammern und rohe Steine
 * bleiben; ein Stein, der sich nicht umrechnen lässt, auch. Die Steine behalten ihre ID, Zufall und Wiederholung.
 */
export function convertPitches(tokens: readonly Token[], to: PitchMode, s: ScaleChoice): Token[] {
  return tokens.map((t) => {
    if (t.kind !== 'sound' || t.sound === '~') return t;
    const next = to === 'relative' ? noteToDegree(t.sound, s) : degreeToNote(t.sound, s);
    return next === null ? t : { ...t, sound: next };
  });
}
