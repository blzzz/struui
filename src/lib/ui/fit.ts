/**
 * Verkleinern auf eine Zeile: eine umbrechende Flex-Reihe (Steine einer `Lane`, Effekt-Boxen einer `EffectList`)
 * wird per CSS `zoom` so weit verkleinert, dass ihre Kinder nebeneinander passen. Daneben steht dann der `FitButton`.
 */

/** Kleinste Verkleinerung, darunter wären Steine und Regler kaum noch zu treffen. Kleiner bricht die Reihe wieder um. */
export const MIN_FIT = 0.5;

/** Ergebnis einer Messung: ist die Reihe in Originalgrösse zu breit, und mit welcher Verkleinerung passt sie. */
export interface FitResult {
  overflows: boolean;
  fit: number;
}

/**
 * Misst bei jeder Grössenänderung die Breite der Reihe in Originalgrösse (Kinder und Abstände) und vergleicht sie mit dem Platz.
 * Gemessen wird in CSS-Pixeln der Reihe (`offsetWidth`, `clientWidth`), nicht mit `getBoundingClientRect`: dessen Werte
 * unter `zoom` sind je nach Browser verkleinert oder nicht (Chrome hat das 2024 geändert, Safari rechnet anders).
 * `applied` ist der gerade angewandte Zoom, der Platz auf dem Bildschirm ist `clientWidth * applied`.
 * `widthOf` gibt die Breite eines Kinds zurück oder null, wenn es nicht zählt (Standard: `offsetWidth`).
 * Solange ein Textfeld in der Reihe den Fokus hat, wird nicht gemessen: die Reihe soll beim Tippen nicht springen.
 * Gibt die Funktion zum Aufräumen zurück.
 */
export function watchFit(
  el: HTMLElement,
  applied: number,
  report: (result: FitResult) => void,
  widthOf: (child: HTMLElement) => number | null = (child) => child.offsetWidth,
): () => void {
  const measure = () => {
    if (el.querySelector("input[type='text']:focus")) return;
    let natural = 0;
    let count = 0;
    for (const child of el.children) {
      const width = widthOf(child as HTMLElement);
      if (width === null) continue;
      natural += width;
      count += 1;
    }
    natural += (parseFloat(getComputedStyle(el).columnGap) || 0) * Math.max(0, count - 1);
    const avail = el.clientWidth * applied;
    // Ohne Spielraum: schon ein Bruchteil eines Pixels zu viel lässt die Reihe umbrechen
    const overflows = natural > avail + 0.01;
    report({ overflows, fit: overflows ? Math.max(MIN_FIT, Math.floor((avail / natural) * 100) / 100) : 1 });
  };
  const observer = new ResizeObserver(measure);
  observer.observe(el);
  for (const child of el.children) observer.observe(child);
  return () => observer.disconnect();
}
