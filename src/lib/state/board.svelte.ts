import {
  MIN_WIDTH,
  boardComment,
  bounds,
  placeAt,
  settle,
} from "../domain/board.ts";
import type { Rect, Spot } from "../domain/board.ts";
import type { TrackType } from "../domain/types.ts";
import { project } from "./project.svelte.ts";
import type { PaletteItem } from "./project.svelte.ts";

/** Höhe einer Spur, bevor ihr Inhalt gemessen ist. */
const START_HEIGHT = 1;

/**
 * Arbeitsfläche: wo jede Spur liegt (in Punkten, siehe `domain/board.ts`), Übersicht und Auswahl.
 * Die Lage gehört nicht zur Szene: sie gilt für alle Szenen. Im Code steht sie als Sammelkommentar (`comment`) für
 * Kopieren, Teilen und Übernehmen; Strudel bekommt ihn nicht, Verschieben ändert nichts am Klang.
 */
class Board {
  /** Lage der Spuren, die gerade da sind. */
  rects = $state<Record<string, Rect>>({});
  /** Übersicht: alle Spuren passen auf den Bildschirm, Antippen wählt eine aus. */
  overview = $state(false);
  /** Zuletzt in der Übersicht gewählte Spur. */
  selected = $state<string | null>(null);
  /** Klang aus der Palette, der nicht über einer Steinreihe gezogen wird: Zeiger in Bildschirmpixeln (Board.svelte prüft, ob dort freie Fläche ist). */
  aim = $state<{ x: number; y: number } | null>(null);
  /** Dort losgelassen: Board.svelte legt auf freier Fläche eine neue Spur an und fragt nach ihrer Art. */
  landed = $state<{ x: number; y: number; item: PaletteItem } | null>(null);

  /** Lage von Spuren, die in der gewählten Szene fehlen: kommen sie zurück, liegen sie wieder dort. */
  private parked = new Map<string, Rect>();
  /** Von Hand aufgezogene Höhe (beim Anlegen): die Spur wird nie niedriger, auch wenn der Inhalt weniger braucht. */
  private minHeight = new Map<string, number>();

  /** Umriss aller Spuren, null ohne Spuren. */
  box = $derived(bounds(Object.values(this.rects)));

  /** Sammelkommentar mit der Lage der Spuren der gewählten Szene (`boardComment`), leer ohne Spuren. */
  comment = $derived(
    boardComment(
      project.tracks.flatMap((t) => {
        const r = this.rects[t.id];
        return r && t.name ? [{ name: t.name, spot: { x: r.x, y: r.y, w: r.w } }] : [];
      }),
    ),
  );

  /**
   * Gleicht die Lagen mit den Spuren ab (nach Szenenwechsel, Code-Übernahme, neuer oder entfernter Spur).
   * Neue Spuren kommen unter alle anderen, in ihrer Reihenfolge. `at`: Lagen aus dem Code nach ID, sie gelten vor allen anderen.
   */
  sync(ids: readonly string[], at?: ReadonlyMap<string, Spot>): void {
    const keep = new Set(ids);
    const now = Object.keys(this.rects);
    if (!at?.size && now.length === ids.length && now.every((id) => keep.has(id))) return;
    const next: Record<string, Rect> = {};
    for (const id of now) {
      if (keep.has(id)) next[id] = this.rects[id];
      else this.parked.set(id, this.rects[id]);
    }
    for (const [id, spot] of at ?? []) {
      if (!keep.has(id)) continue;
      const h = next[id]?.h ?? this.parked.get(id)?.h ?? START_HEIGHT;
      next[id] = { ...spot, h };
      this.parked.delete(id);
    }
    for (const id of ids) {
      if (next[id]) continue;
      next[id] =
        this.parked.get(id) ??
        placeAt(Object.values(next), "bottom", MIN_WIDTH, START_HEIGHT);
      this.parked.delete(id);
    }
    this.rects = settle(next);
    if (this.selected && !keep.has(this.selected)) this.selected = null;
  }

  /** Lagen aus dem Sammelkommentar über die Namen der Spuren übernehmen. Spuren ohne Eintrag bleiben, wo sie sind. */
  place(spots: ReadonlyMap<string, Spot>): void {
    const at = new Map<string, Spot>();
    for (const t of project.tracks) {
      const spot = spots.get(t.name);
      if (spot) at.set(t.id, spot);
    }
    this.sync(
      project.tracks.map((t) => t.id),
      at,
    );
  }

  /**
   * Neue Spur an der aufgezogenen Stelle (obere linke Ecke und Höhe, Breite `MIN_WIDTH`). Die Höhe bleibt als Mindesthöhe.
   * Liegen dort Spuren, rücken sie nach unten. Mit `item` beginnt sie mit diesem Klang (`project.addTrack`). Gibt ihre ID zurück.
   */
  add(type: TrackType, x: number, y: number, h: number, item?: PaletteItem): string {
    const id = project.addTrack(type, item);
    const height = Math.max(1, h);
    this.minHeight.set(id, height);
    this.rects = settle({ ...this.rects, [id]: { x, y, w: MIN_WIDTH, h: height } }, id);
    return id;
  }

  /** Spur an einen neuen Platz; liegt dort schon eine, rückt sie nach unten. */
  move(id: string, x: number, y: number): void {
    const r = this.rects[id];
    if (!r || (r.x === x && r.y === y)) return;
    this.rects = settle({ ...this.rects, [id]: { ...r, x, y } }, id);
  }

  /** Neue Breite in Punkten, mindestens `MIN_WIDTH`. */
  resize(id: string, w: number): void {
    const r = this.rects[id];
    const width = Math.max(MIN_WIDTH, w);
    if (!r || r.w === width) return;
    this.rects = settle({ ...this.rects, [id]: { ...r, w: width } }, id);
  }

  /** Der Inhalt braucht `h` Punkte (mindestens die aufgezogene Höhe): die Spur wächst nach unten und schiebt die darunter weg. */
  measured(id: string, content: number): void {
    const r = this.rects[id];
    const h = Math.max(content, this.minHeight.get(id) ?? 1);
    if (!r || r.h === h) return;
    this.rects = settle({ ...this.rects, [id]: { ...r, h } }, id);
  }
}

export const board = new Board();
