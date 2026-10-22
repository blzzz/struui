/**
 * Arbeitsfläche: Spuren sind Rechtecke auf einem unendlichen Punkteraster. Alle Masse in Punkten (ganze Zahlen),
 * ein Rechteck deckt die Punkte `x … x+w-1` und `y … y+h-1`. Die Lage ändert nichts am Klang; im Code steht sie nur als
 * Sammelkommentar (`boardComment`).
 * Rein, ohne Abhängigkeit zu DOM, Svelte oder Audio.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Seite der Fläche, an der eine neue Spur entsteht. */
export type Side = "top" | "right" | "bottom" | "left";

/** Schmalste Spur: fünf Punkte, so viele passen auf einen Handybildschirm. */
export const MIN_WIDTH = 5;

/** Kleinster Abstand zweier Punkte in Pixeln. */
export const MIN_GAP = 30;

/** Rand des Rechtecks über den äussersten Punkt hinaus, als Anteil des Abstands. Zwischen Nachbarn bleibt `1 - 2 * PAD`. */
export const PAD = 0.35;

export function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}

/** Kleinstes Rechteck um alle, null ohne Rechtecke. */
export function bounds(rects: Iterable<Rect>): Rect | null {
  let box: Rect | null = null;
  for (const r of rects) {
    if (!box) {
      box = { ...r };
      continue;
    }
    const right = Math.max(box.x + box.w, r.x + r.w);
    const bottom = Math.max(box.y + box.h, r.y + r.h);
    box.x = Math.min(box.x, r.x);
    box.y = Math.min(box.y, r.y);
    box.w = right - box.x;
    box.h = bottom - box.y;
  }
  return box;
}

/**
 * Löst Überlappungen auf, indem Rechtecke nach unten rücken, nie nach oben oder zur Seite. `fixed` (eben verschoben,
 * verbreitert oder gewachsen) bleibt stehen, die anderen kommen in Lesereihenfolge (oben nach unten, dann links nach rechts)
 * an den ersten freien Platz darunter. Gibt neue Rechtecke zurück, nur die bewegten sind neue Objekte.
 */
export function settle(
  rects: Readonly<Record<string, Rect>>,
  fixed?: string,
): Record<string, Rect> {
  const ids = Object.keys(rects).sort((a, b) => {
    if (a === fixed) return -1;
    if (b === fixed) return 1;
    return rects[a].y - rects[b].y || rects[a].x - rects[b].x;
  });
  const placed: Rect[] = [];
  const out: Record<string, Rect> = {};
  for (const id of ids) {
    let r = rects[id];
    for (;;) {
      const hit = placed.filter((p) => overlaps(r, p));
      if (hit.length === 0) break;
      r = { ...r, y: Math.max(...hit.map((p) => p.y + p.h)) };
    }
    placed.push(r);
    out[id] = r;
  }
  return out;
}

/**
 * Lage einer neuen Spur der Grösse `w`×`h` aussen an einer Seite aller Spuren: oben und unten bündig links,
 * rechts und links bündig oben. Ohne Spuren am Ursprung.
 */
export function placeAt(
  rects: Iterable<Rect>,
  side: Side,
  w: number,
  h: number,
): Rect {
  const box = bounds(rects);
  if (!box) return { x: 0, y: 0, w, h };
  switch (side) {
    case "top":
      return { x: box.x, y: box.y - h, w, h };
    case "bottom":
      return { x: box.x, y: box.y + box.h, w, h };
    case "left":
      return { x: box.x - w, y: box.y, w, h };
    case "right":
      return { x: box.x + box.w, y: box.y, w, h };
  }
}

/** Wie viele Punkte ein Rechteck braucht, damit `px` Pixel hineinpassen (mindestens einer). */
export function dotsFor(px: number, gap: number): number {
  return Math.max(1, Math.ceil((px - 2 * PAD * gap) / gap - 1e-6) + 1);
}

/** Breite bzw. Höhe eines Rechtecks über `dots` Punkte in Pixeln, Rand eingeschlossen. */
export function pxFor(dots: number, gap: number): number {
  return (dots - 1 + 2 * PAD) * gap;
}

/**
 * Abstand der Punkte für eine Bildschirmbreite: eine Spur von `MIN_WIDTH` Punkten passt mit `margin` Pixeln auf jeder
 * Seite hinein, mindestens `MIN_GAP`, höchstens `max`.
 */
export function gapFor(viewportWidth: number, margin = 8, max = 80): number {
  const fit = Math.floor(
    (viewportWidth - 2 * margin) / (MIN_WIDTH - 1 + 2 * PAD),
  );
  return Math.max(MIN_GAP, Math.min(max, fit));
}

/**
 * Magnet zum Raster beim Verschieben: `v` ist die tatsächliche Lage in Punkten, zurück kommt die gezeigte.
 * Nahe einem ganzen Punkt bewegt sie sich kaum, auf halbem Weg springt sie rasch zum nächsten (`strength` > 1, 1 = kein Magnet).
 * Ganze Punkte und halbe bleiben, wo sie sind; die Kurve ist stetig und steigt monoton.
 */
export function magnet(v: number, strength = 3): number {
  const n = Math.round(v);
  const d = v - n;
  return n + Math.sign(d) * 0.5 * Math.pow(2 * Math.abs(d), strength);
}

/** Lage einer Spur, wie sie im Code steht: obere linke Ecke und Breite. Die Höhe ergibt sich aus dem Inhalt. */
export type Spot = Pick<Rect, "x" | "y" | "w">;

/** Erkennungszeichen des Sammelkommentars (`/* board: drums 0,0; hats 6,0,8 *\/`). */
const BOARD_TAG = "board:";

/**
 * Sammelkommentar mit der Lage aller Spuren, über ihre Namen: `name x,y`, die Breite als dritte Zahl nur, wenn sie von
 * `MIN_WIDTH` abweicht. Leer ohne Spuren. Namen bestehen aus Buchstaben, Ziffern und `_` (`trackName`), sie beenden den
 * Kommentar nie und enthalten weder Leerzeichen noch `;`.
 */
export function boardComment(
  spots: readonly { name: string; spot: Spot }[],
): string {
  if (spots.length === 0) return "";
  const parts = spots.map(
    ({ name, spot: { x, y, w } }) =>
      `${name} ${x},${y}${w === MIN_WIDTH ? "" : `,${w}`}`,
  );
  return `/* ${BOARD_TAG} ${parts.join("; ")} */`;
}

const SPOT = /^([\p{L}\p{Nd}_]+)\s+(-?\d+)\s*,\s*(-?\d+)(?:\s*,\s*(\d+))?$/u;

/**
 * Liest den Inhalt eines Blockkommentars (ohne `/*` und `*\/`). Null, wenn es kein Sammelkommentar ist.
 * Unlesbare Einträge fallen weg, bei doppeltem Namen gilt der erste, eine Breite unter `MIN_WIDTH` wird `MIN_WIDTH`.
 */
export function readBoardComment(text: string): Map<string, Spot> | null {
  const body = text.trim();
  if (!body.startsWith(BOARD_TAG)) return null;
  const spots = new Map<string, Spot>();
  for (const part of body.slice(BOARD_TAG.length).split(";")) {
    const m = SPOT.exec(part.trim());
    if (!m || spots.has(m[1])) continue;
    const w = m[4] === undefined ? MIN_WIDTH : Math.max(MIN_WIDTH, Number(m[4]));
    spots.set(m[1], { x: Number(m[2]), y: Number(m[3]), w });
  }
  return spots;
}
