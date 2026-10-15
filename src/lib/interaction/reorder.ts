import type { Attachment } from 'svelte/attachments';

export interface ReorderOptions {
  /** Das Element, das mitwandert (die ganze Box), und alle Geschwister, unter denen es seinen Platz sucht. */
  item(): HTMLElement | null;
  items(): HTMLElement[];
  /** Einfügeposition vor dem Entfernen, null = kein Ziel (zurück an den alten Platz). */
  onHint(index: number | null): void;
  onDrop(index: number): void;
}

/** Ab so vielen Pixeln wird aus dem Drücken ein Ziehen. */
const THRESHOLD = 6;

/**
 * Ziehen am Griff (Titel einer Box) verschiebt die Box unter ihren Geschwistern, die links nach rechts umbrechen.
 * Ziel ist die nächstgelegene Box: links von ihrer Mitte davor, rechts danach.
 * Wie beim Ziehen der Steine hört die Geste nach dem Drücken am ganzen Fenster zu und bricht bei `Escape`,
 * verlorenem Fokus oder `pointercancel` ab. Während des Ziehens trägt die Box `data-dragging`.
 */
export function reorder(get: () => ReorderOptions): Attachment<HTMLElement> {
  return (handle) => {
    let sx = 0;
    let sy = 0;
    let dragging = false;
    let target: number | null = null;
    let moving: HTMLElement | null = null;

    const targetAt = (x: number, y: number): number | null => {
      const all = get().items();
      let best = -1;
      let bestDist = Infinity;
      all.forEach((el, i) => {
        if (el === moving) return;
        const r = el.getBoundingClientRect();
        const dx = Math.max(r.left - x, 0, x - r.right);
        const dy = Math.max(r.top - y, 0, y - r.bottom);
        const d = Math.hypot(dx, dy);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      if (best < 0) return null;
      const r = all[best].getBoundingClientRect();
      return x < r.left + r.width / 2 ? best : best + 1;
    };

    const stop = (drop: boolean) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onCancel);
      if (moving) {
        moving.style.transform = '';
        delete moving.dataset.dragging;
      }
      const o = get();
      o.onHint(null);
      if (drop && dragging && target !== null) o.onDrop(target);
      dragging = false;
      target = null;
      moving = null;
    };

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (!dragging) {
        if (Math.hypot(dx, dy) < THRESHOLD) return;
        moving = get().item();
        if (!moving) return stop(false);
        dragging = true;
        moving.dataset.dragging = '';
      }
      e.preventDefault();
      if (moving) moving.style.transform = `translate(${dx}px, ${dy}px)`;
      target = targetAt(e.clientX, e.clientY);
      get().onHint(target);
    };
    const onUp = () => stop(true);
    const onCancel = () => stop(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop(false);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      sx = e.clientX;
      sy = e.clientY;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onKey);
      window.addEventListener('blur', onCancel);
    };

    handle.addEventListener('pointerdown', onDown);
    return () => {
      handle.removeEventListener('pointerdown', onDown);
      stop(false);
    };
  };
}
