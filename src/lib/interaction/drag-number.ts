import type { Attachment } from 'svelte/attachments';

export interface DragNumberOptions {
  /** Zahl beim Beginn des Ziehens (die im Feld). */
  value(): number;
  /** Änderung pro Schritt. */
  step(): number;
  /** Kleinster Wert, sonst unbegrenzt. */
  min?(): number;
  /** Pixel pro Schritt, Standard 2. */
  px?(): number;
  onChange(value: number): void;
}

/** Ab so vielen Pixeln wird aus dem Drücken ein Ziehen. */
const THRESHOLD = 4;

const decimalsOf = (n: number): number => String(n).split('.')[1]?.length ?? 0;

/**
 * Zahlenfeld zum Ziehen: hoch und runter ändert den Wert in Schritten (`step` pro `px` Pixel), Tippen ohne Ziehen setzt
 * den Cursor ins Feld zum Eintippen (noch in der Geste, damit iOS die Tastatur öffnet). Ist das Feld schon fokussiert,
 * bleibt alles beim Alten (Text markieren). Während des Ziehens trägt das Feld `data-dragging`.
 * Die Optionen werden erst im Ereignis gelesen, damit die Anbindung nicht neu aufgebaut wird.
 */
export function dragNumber(get: () => DragNumberOptions): Attachment<HTMLInputElement> {
  return (el) => {
    let down = false;
    let dragging = false;
    let sy = 0;
    let start = 0;
    let last = NaN;

    const onDown = (e: PointerEvent) => {
      if (el.disabled || document.activeElement === el || e.button !== 0) return;
      // Kein Fokus und keine Textauswahl beim Drücken: erst beim Loslassen ohne Ziehen
      e.preventDefault();
      down = true;
      dragging = false;
      sy = e.clientY;
      start = get().value();
      last = start;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // egal: manche Browser lehnen das ab
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dy = sy - e.clientY;
      if (!dragging && Math.abs(dy) < THRESHOLD) return;
      if (!dragging) el.dataset.dragging = '';
      dragging = true;
      const o = get();
      const step = o.step();
      const raw = start + Math.round(dy / (o.px?.() ?? 2)) * step;
      const lo = o.min?.();
      const next = Number((lo === undefined ? raw : Math.max(lo, raw)).toFixed(Math.max(decimalsOf(step), decimalsOf(start))));
      if (next === last) return;
      last = next;
      o.onChange(next);
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      delete el.dataset.dragging;
      if (dragging) return;
      el.focus();
      el.select();
    };
    const onCancel = () => {
      down = false;
      delete el.dataset.dragging;
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
    };
  };
}
