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
 * Gemessen wird immer ohne Verkleinerung: die Reihe bekommt dafür kurz `zoom: 1` (im selben Durchgang zurückgesetzt, also
 * nie zu sehen). Werte unter `zoom` rechnen die Browser verschieden (Chrome hat das 2024 geändert, Safari rechnet anders);
 * wurde unter dem angewandten Zoom gemessen, konnte das Ergebnis den Zoom ändern, das wiederum die Messung, und die Reihe
 * flackerte (auf iOS beim Start beobachtet). So hängt das Ergebnis nur vom Platz und den Kindern ab und ist beim zweiten
 * Messen dasselbe.
 * `widthOf` gibt die Breite eines Kinds zurück oder null, wenn es nicht zählt (Standard: `offsetWidth`).
 * Solange ein Textfeld in der Reihe den Fokus hat, wird nicht gemessen: die Reihe soll beim Tippen nicht springen.
 * Gibt die Funktion zum Aufräumen zurück.
 */
export function watchFit(
  el: HTMLElement,
  report: (result: FitResult) => void,
  widthOf: (child: HTMLElement) => number | null = (child) => child.offsetWidth,
): () => void {
  const measure = () => {
    if (el.querySelector("input[type='text']:focus")) return;
    const before = el.style.zoom;
    el.style.zoom = '1';
    let natural = 0;
    let count = 0;
    for (const child of el.children) {
      const width = widthOf(child as HTMLElement);
      if (width === null) continue;
      natural += width;
      count += 1;
    }
    natural += (parseFloat(getComputedStyle(el).columnGap) || 0) * Math.max(0, count - 1);
    const avail = el.clientWidth;
    el.style.zoom = before;
    // Ohne Spielraum: schon ein Bruchteil eines Pixels zu viel lässt die Reihe umbrechen
    const overflows = natural > avail + 0.01;
    report({ overflows, fit: overflows ? Math.max(MIN_FIT, Math.floor((avail / natural) * 100) / 100) : 1 });
  };
  const observer = new ResizeObserver(measure);
  observer.observe(el);
  for (const child of el.children) observer.observe(child);
  return () => observer.disconnect();
}
