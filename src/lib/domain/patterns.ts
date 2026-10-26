/**
 * Gespeicherte Patterns: je Pattern der volle Code (wie «Code kopieren», mit Lage der Spuren und Aufnahmen).
 * Beim Laden wird er wie in der Code-Ansicht übernommen; was nicht im Code steht (Szenen, Arrangement), ist nicht dabei.
 * Hier nur das Format und die Liste, das Lesen und Schreiben im Browser macht `state/patterns.svelte.ts`.
 */

export interface Pattern {
  id: string;
  name: string;
  code: string;
  /** Zuletzt gespeichert, Millisekunden seit 1970. */
  updated: number;
}

export interface PatternStore {
  version: 1;
  /** Das Pattern, das beim Neuladen wieder erscheint. */
  current: string | null;
  patterns: Pattern[];
}

export const EMPTY_STORE: PatternStore = { version: 1, current: null, patterns: [] };

const isPattern = (p: unknown): p is Pattern =>
  typeof p === 'object' &&
  p !== null &&
  typeof (p as Pattern).id === 'string' &&
  typeof (p as Pattern).name === 'string' &&
  typeof (p as Pattern).code === 'string' &&
  typeof (p as Pattern).updated === 'number';

/** Gespeicherten Text lesen. Fehlt er, ist er kaputt oder von einer anderen Version, gibt es eine leere Liste. */
export function readStore(text: string | null): PatternStore {
  if (!text) return EMPTY_STORE;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return EMPTY_STORE;
  }
  const s = data as Partial<PatternStore> | null;
  if (!s || s.version !== 1 || !Array.isArray(s.patterns)) return EMPTY_STORE;
  const patterns = s.patterns.filter(isPattern);
  const current = patterns.some((p) => p.id === s.current) ? (s.current as string) : null;
  return { version: 1, current, patterns };
}

/** Name für ein neues Pattern: «Pattern 1», sonst die nächste freie Nummer. */
export function patternName(names: readonly string[]): string {
  const used = new Set(names);
  let n = 1;
  while (used.has(`Pattern ${n}`)) n += 1;
  return `Pattern ${n}`;
}

/** Pattern einfügen oder ersetzen (gleiche ID), es wird das aktuelle. */
export function savePattern(store: PatternStore, pattern: Pattern): PatternStore {
  const known = store.patterns.some((p) => p.id === pattern.id);
  const patterns = known ? store.patterns.map((p) => (p.id === pattern.id ? pattern : p)) : [...store.patterns, pattern];
  return { ...store, current: pattern.id, patterns };
}

/** Pattern entfernen. War es das aktuelle, gibt es keins mehr (der Aufrufer lädt ein anderes). */
export function removePattern(store: PatternStore, id: string): PatternStore {
  return {
    ...store,
    current: store.current === id ? null : store.current,
    patterns: store.patterns.filter((p) => p.id !== id),
  };
}

/** Zuletzt gespeichertes zuerst. */
export function byRecent(patterns: readonly Pattern[]): Pattern[] {
  return [...patterns].sort((a, b) => b.updated - a.updated);
}
