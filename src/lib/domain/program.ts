/**
 * Ganzer Code zurück zu Spuren: welche bisherige Spur eine Zeile des Stapels übernimmt. Rein, ohne Abhängigkeit zu
 * DOM, Svelte oder Audio. Das Lesen des Codes selbst steht in `syntax/from-program.ts`.
 */

/** Eine bisherige Spur: ihr Name und ob sie im Code steht (`inCode`). Spuren ohne Steine stehen nicht darin. */
export interface OldTrack {
  name: string;
  shown: boolean;
}

/**
 * Für jede Zeile des Stapels (`names`, ihr Name oder leer) der Index der bisherigen Spur, die sie übernimmt, sonst null.
 * Zuerst nach gleichem Namen, dann nach Stelle unter den Spuren, die im Code standen. Jede Spur höchstens einmal.
 * So behalten Spuren beim Bearbeiten ihre ID (Aufleuchten, Szenen), auch wenn Zeilen dazukommen oder wegfallen.
 */
export function matchTracks(old: readonly OldTrack[], names: readonly string[]): (number | null)[] {
  const used = new Set<number>();
  const result: (number | null)[] = names.map((name) => {
    if (!name) return null;
    const i = old.findIndex((o, j) => o.shown && o.name === name && !used.has(j));
    if (i < 0) return null;
    used.add(i);
    return i;
  });
  const shown = old.flatMap((o, i) => (o.shown ? [i] : []));
  return result.map((r, k) => {
    if (r !== null) return r;
    const i = shown[k];
    // Nach Stelle nur eine Spur ohne eigenen Namen in den Zeilen, sonst nähme sie einer späteren Zeile die Spur weg
    if (i === undefined || used.has(i) || names.includes(old[i].name)) return null;
    used.add(i);
    return i;
  });
}

/**
 * Die neue Reihenfolge: zuerst die Zeilen des Stapels (`match` aus `matchTracks`, neue Zeilen als null), dann die bisherigen
 * Spuren, die nicht im Code standen (ohne Steine), in ihrer Reihenfolge. Spuren, die im Code standen und keine Zeile mehr
 * haben, fallen weg. Ergebnis: je Stelle der Index der bisherigen Spur oder null für eine neue.
 */
export function arrangeTracks(old: readonly OldTrack[], match: readonly (number | null)[]): (number | null)[] {
  return [...match, ...old.flatMap((o, i) => (o.shown ? [] : [i]))];
}
