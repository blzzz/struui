/**
 * Arrangement: Szenen hintereinander, jede mit einer Zahl von Zyklen (wie `!` in der Mini-Notation).
 * Im Code steht jede Szene als Variable und dahinter `arrange([4, Szene01], [2, Szene02])`.
 * Rein, ohne Abhängigkeit zu DOM, Svelte oder Audio.
 */

import { newId } from './types.ts';

export interface Section {
  id: string;
  sceneId: string;
  /** Zyklen, 1 bis TIMES_MAX. Als `!`-Knopf unter dem Stein, im Code die Zahl vor der Szene. */
  times: number;
}

/** Raststufen des `!`-Knopfs unter einem Abschnitt. */
export const TIMES_VALUES = [1, 2, 3, 4, 6, 8, 12, 16] as const;
export const TIMES_MAX = 16;

export function section(sceneId: string, times = 1): Section {
  return { id: newId('a'), sceneId, times: clampTimes(times) };
}

export function clampTimes(n: number): number {
  return Number.isFinite(n) ? Math.min(TIMES_MAX, Math.max(1, Math.round(n))) : 1;
}

/** Abschnitt an `index` einfügen (in die gleiche Liste). */
export function insertSection(list: Section[], index: number, s: Section): void {
  list.splice(Math.max(0, Math.min(index, list.length)), 0, s);
}

/** Abschnitt verschieben. `to` ist die Einfügeposition vor dem Herausnehmen (wie beim Ablegen gezeigt). */
export function moveSection(list: Section[], id: string, to: number): void {
  const from = list.findIndex((s) => s.id === id);
  if (from < 0) return;
  const [s] = list.splice(from, 1);
  list.splice(Math.max(0, Math.min(to > from ? to - 1 : to, list.length)), 0, s);
}

/**
 * Wo das Arrangement bei Zyklus `cycle` steht (gezählt ab Start, `arrange` beginnt bei 0 und wiederholt sich):
 * der Abschnitt und der Anteil am ganzen Durchlauf (0–1). Null ohne Abschnitte.
 */
export function positionAt(
  list: readonly Pick<Section, 'id' | 'times'>[],
  cycle: number,
): { sectionId: string; progress: number } | null {
  const total = list.reduce((sum, s) => sum + s.times, 0);
  if (total === 0 || !Number.isFinite(cycle)) return null;
  const at = ((cycle % total) + total) % total;
  let start = 0;
  for (const s of list) {
    if (at < start + s.times) return { sectionId: s.id, progress: at / total };
    start += s.times;
  }
  return null;
}

/** Gültige JS-Namen, so nah wie möglich am Szenennamen, alle verschieden. */
export function sceneVariables(names: readonly string[]): string[] {
  const taken = new Set<string>();
  return names.map((name) => {
    let base = name.trim().replace(/[^\p{L}\p{N}_$]+/gu, '_') || 'Szene';
    if (/^\p{N}/u.test(base)) base = `_${base}`;
    if (RESERVED.has(base)) base = `${base}_`;
    let v = base;
    for (let n = 2; taken.has(v); n += 1) v = `${base}_${n}`;
    taken.add(v);
    return v;
  });
}

/**
 * Namen, die eine Szene nicht verdecken darf: JavaScript und die Strudel-Funktionen, die der Code braucht oder die
 * man als Szenennamen erwarten könnte. Eine Szene namens `s` würde sonst `s("bd")` kaputt machen.
 */
const RESERVED = new Set([
  ...'break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null return super switch this throw true try typeof var void while with yield await enum implements interface package private protected public static arguments eval undefined NaN Infinity'.split(' '),
  ...'s n note sound stack cat seq fastcat slowcat arrange silence samples setcps setcpm slider pure sequence register hush'.split(' '),
]);
