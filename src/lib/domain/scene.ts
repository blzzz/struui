/**
 * Szene: der ganze Projektzustand (alle Spuren, globale Effekte und das Tempo) mit Namen. Es gibt immer mindestens eine;
 * eine neue entsteht als Kopie der aktuellen. Rein, ohne Abhängigkeit zu DOM, Svelte oder Audio.
 */

import { newId } from './types.ts';
import type { Effect } from './effects.ts';
import type { Track } from './types.ts';

export interface Scene {
  id: string;
  name: string;
  tracks: Track[];
  cps: number;
  /** Globale Effekte der Szene (am Stapel, `stack(…).room(.3)`, im Arrangement am Stapel der Szene). */
  global: Effect[];
}

/** Eigene Kopie: spätere Änderungen an den Spuren treffen die Szene nicht und umgekehrt. */
const copy = <T>(items: readonly T[]): T[] => structuredClone(items) as T[];

/** Erster freier Standardname («Szene01», «Szene02» …). */
export function sceneName(existing: readonly Pick<Scene, 'name'>[]): string {
  const taken = new Set(existing.map((s) => s.name));
  const name = (n: number) => `Szene${String(n).padStart(2, '0')}`;
  let n = existing.length + 1;
  while (taken.has(name(n))) n += 1;
  return name(n);
}

export function scene(name: string, tracks: readonly Track[], cps: number, global: readonly Effect[] = []): Scene {
  return { id: newId('p'), name, tracks: copy(tracks), cps, global: copy(global) };
}

/** Dieselbe Szene mit neuem Inhalt (als Kopie), Name und ID bleiben. */
export function withContent(s: Scene, tracks: readonly Track[], cps: number, global: readonly Effect[] = []): Scene {
  return { ...s, tracks: copy(tracks), cps, global: copy(global) };
}

/** Hat die Szene genau diesen Inhalt? Sonst gibt es Änderungen, die noch nicht in ihr stehen. */
export function sameContent(s: Scene, tracks: readonly Track[], cps: number, global: readonly Effect[] = []): boolean {
  return s.cps === cps && JSON.stringify(s.tracks) === JSON.stringify(tracks) && JSON.stringify(s.global) === JSON.stringify(global);
}

/** Spuren zum Laden, als neue Kopie. IDs bleiben, so passen Hervorhebung und Kompaktansicht wieder. */
export function restoreTracks(s: Scene): Track[] {
  return copy(s.tracks);
}

/** Globale Effekte zum Laden, als neue Kopie mit gleichen IDs. */
export function restoreGlobal(s: Scene): Effect[] {
  return copy(s.global);
}
