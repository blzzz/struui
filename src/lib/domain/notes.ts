/**
 * Noten auf den Steinen einer Notenspur (`note("f d")`). Die Schreibweise ist Strudels eigene (`@strudel/core/util.mjs`):
 * Tonname, Vorzeichen (`#` oder `s` erhöht, `b` oder `f` erniedrigt), Oktave (Standard 3). Zahlen sind MIDI-Noten (`60` = c4).
 */

const NOTE = /^([a-gA-G])([#bsf]*)(-?\d*)$/;
const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;

/** Die Stammtöne in der Palette. Vorzeichen und Oktaven kommen beim Bearbeiten im Stein dazu. */
export const NOTE_NAMES = ['c', 'd', 'e', 'f', 'g', 'a', 'b'] as const;

/** Klang einer neuen Notenspur (`.s("sine")`). */
export const DEFAULT_VOICE = 'sine';

/** Oktave, wenn keine angegeben ist (wie in Strudel). */
const DEFAULT_OCTAVE = 3;

const CHROMA: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const SHARPS = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const FLATS = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b'];

/** Ein Notenname (`f`, `c#4`, `eb3`) oder eine MIDI-Nummer (`60`). */
export function isNote(text: string): boolean {
  return NOTE.test(text) || NUMBER.test(text);
}

function toMidi(name: string): number | null {
  const m = NOTE.exec(name);
  if (!m) return null;
  const [, pc, acc, oct] = m;
  const offset = [...acc].reduce((sum, c) => sum + (c === '#' || c === 's' ? 1 : -1), 0);
  return (Number(oct || DEFAULT_OCTAVE) + 1) * 12 + CHROMA[pc.toLowerCase()] + offset;
}

/**
 * Einen Halbton höher (`dir` 1) oder tiefer (-1), für ↑/↓ beim Bearbeiten eines Notensteins.
 * Aufwärts mit `#`, abwärts mit `b`. Ohne Oktave bleibt die Oktave weg, solange sie 3 bleibt. Zahlen zählen um 1.
 * Was keine Note ist, bleibt unverändert.
 */
export function stepNote(current: string, dir: 1 | -1): string {
  const text = current.trim();
  if (NUMBER.test(text)) return String(Number(text) + dir);
  const midi = toMidi(text);
  if (midi === null) return current;
  const next = midi + dir;
  const octave = Math.floor(next / 12) - 1;
  const name = (dir === 1 ? SHARPS : FLATS)[((next % 12) + 12) % 12];
  const hadOctave = NOTE.exec(text)?.[3] !== '';
  return hadOctave || octave !== DEFAULT_OCTAVE ? `${name}${octave}` : name;
}
