/**
 * Szene: der ganze Projektzustand (alle Spuren und das Tempo) mit Namen. Es gibt immer mindestens eine;
 * eine neue entsteht als Kopie der aktuellen. Rein, ohne Abhängigkeit zu DOM, Svelte oder Audio.
 */

import { newId } from './types.ts';
import type { Track } from './types.ts';

export interface Scene {
  id: string;
  name: string;
  tracks: Track[];
  cps: number;
}

/** Eigene Kopie: spätere Änderungen an den Spuren treffen die Szene nicht und umgekehrt. */
const copy = (tracks: readonly Track[]): Track[] => structuredClone(tracks) as Track[];

/** Erster freier Standardname («Szene01», «Szene02» …). */
export function sceneName(existing: readonly Pick<Scene, 'name'>[]): string {
  const taken = new Set(existing.map((s) => s.name));
  const name = (n: number) => `Szene${String(n).padStart(2, '0')}`;
  let n = existing.length + 1;
  while (taken.has(name(n))) n += 1;
  return name(n);
}

export function scene(name: string, tracks: readonly Track[], cps: number): Scene {
  return { id: newId('p'), name, tracks: copy(tracks), cps };
}

/** Dieselbe Szene mit neuem Inhalt (als Kopie), Name und ID bleiben. */
export function withContent(s: Scene, tracks: readonly Track[], cps: number): Scene {
  return { ...s, tracks: copy(tracks), cps };
}

/** Hat die Szene genau diesen Inhalt? Sonst gibt es Änderungen, die noch nicht in ihr stehen. */
export function sameContent(s: Scene, tracks: readonly Track[], cps: number): boolean {
  return s.cps === cps && JSON.stringify(s.tracks) === JSON.stringify(tracks);
}

/** Spuren zum Laden, als neue Kopie. IDs bleiben, so passen Hervorhebung und Kompaktansicht wieder. */
export function restoreTracks(s: Scene): Track[] {
  return copy(s.tracks);
}
