/**
 * Snapshot: der ganze Projektzustand (alle Spuren und das Tempo) zu einem Zeitpunkt, mit Namen.
 * Laden ersetzt den Zustand vollständig. Rein, ohne Abhängigkeit zu DOM, Svelte oder Audio.
 */

import { newId } from './types.ts';
import type { Track } from './types.ts';

export interface Snapshot {
  id: string;
  name: string;
  tracks: Track[];
  cps: number;
  /** Der Code zum Zeitpunkt des Snapshots. Gleich dem aktuellen Code = dieser Snapshot ist geladen. */
  code: string;
}

/** Eigene Kopie: spätere Änderungen an den Spuren treffen den Snapshot nicht und umgekehrt. */
const copy = (tracks: readonly Track[]): Track[] => structuredClone(tracks) as Track[];

/** Erster freier Standardname («Snapshot 1», «Snapshot 2» …). */
export function snapshotName(existing: readonly Pick<Snapshot, 'name'>[]): string {
  const taken = new Set(existing.map((s) => s.name));
  let n = existing.length + 1;
  while (taken.has(`Snapshot ${n}`)) n += 1;
  return `Snapshot ${n}`;
}

export function snapshot(name: string, tracks: readonly Track[], cps: number, code: string): Snapshot {
  return { id: newId('p'), name, tracks: copy(tracks), cps, code };
}

/** Spuren zum Laden, als neue Kopie. IDs bleiben, so passen Hervorhebung und Kompaktansicht wieder. */
export function restoreTracks(s: Snapshot): Track[] {
  return copy(s.tracks);
}
