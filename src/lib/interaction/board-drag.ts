import type { Attachment } from 'svelte/attachments';

export interface BoardDragOptions {
  /** Laufende Verschiebung in Bildschirmpixeln seit dem Drücken. */
  onMove(dx: number, dy: number): void;
  /** Losgelassen nach einem Ziehen. */
  onDrop(dx: number, dy: number): void;
  /** Abgebrochen (Escape, Fokus weg, `pointercancel`): zurück an den alten Platz. */
  onCancel(): void;
  /** Losgelassen ohne Ziehen. */
  onTap?(): void;
}

/** Ab so vielen Pixeln wird aus dem Drücken ein Ziehen. */
const THRESHOLD = 6;

/**
 * Ziehen auf der Arbeitsfläche: eine Spur verschieben (Griff im Kopf, in der Übersicht die ganze Spur) oder verbreitern
 * (Ecke unten rechts). Wie `reorder` hört die Geste nach dem Drücken am ganzen Fenster zu und bricht bei `Escape`,
 * verlorenem Fokus oder `pointercancel` ab. Das Element braucht `touch-action: none`, sonst scrollt der Browser.
 */
export function boardDrag(get: () => BoardDragOptions): Attachment<HTMLElement> {
  return (handle) => {
    let sx = 0;
    let sy = 0;
    let dragging = false;

    const stop = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onCancel);
      const was = dragging;
      dragging = false;
      return was;
    };

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (!dragging) {
        if (Math.hypot(dx, dy) < THRESHOLD) return;
        dragging = true;
      }
      e.preventDefault();
      get().onMove(dx, dy);
    };
    const onUp = (e: PointerEvent) => {
      if (stop()) get().onDrop(e.clientX - sx, e.clientY - sy);
      else get().onTap?.();
    };
    const onCancel = () => {
      if (stop()) get().onCancel();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
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
      if (stop()) get().onCancel();
    };
  };
}
