import type { Attachment } from 'svelte/attachments';
import { indexForAngle, positionForAngle } from '../domain/scales.ts';
import { LONG_PRESS_MS } from './token-gestures.ts';

export interface KnobOptions {
  /** Ist der Knopf eingeschaltet (nur dann lässt er sich drehen)? */
  active(): boolean;
  stageCount(): number;
  onTap(): void;
  onStage(index: number): void;
  /** Stufenlos: Stellung 0 … 1 statt `onStage` (dann ohne Raststufen). */
  onTurn?(position: number): void;
  /** Stellung beim Beginn des Drehens (für `onTurn`, damit der Knopf im toten Bereich unten nicht springt). */
  position?(): number;
  /** Langes Drücken (ohne Drehen), auch auf den ausgeschalteten Knopf, z. B. um den Wert einzutippen. Schaltet nie um. */
  onLongPress?(): void;
  /** Loslassen nach langem Drücken: noch in der Geste, damit iOS beim Fokussieren eines Felds die Tastatur öffnet. */
  onLongRelease?(): void;
}

/**
 * Tippen schaltet, Ziehen im Bogen um die Mitte dreht (rastet auf Stufen, mit `onTurn` stufenlos), langes Drücken ruft `onLongPress`.
 * Ereignisse aus einem Eingabefeld im Knopf bleiben unbeachtet.
 * Die Optionen werden erst im Ereignis gelesen, damit die Anbindung nicht neu aufgebaut wird.
 * Während des Drehens trägt das Element `data-turning` (zum Hervorheben per CSS).
 */
export function knob(get: () => KnobOptions): Attachment<HTMLElement> {
  return (el) => {
    let down = false;
    let moved = false;
    let long = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sx = 0;
    let sy = 0;
    /** Letzte Stellung beim stufenlosen Drehen. */
    let last = 0;
    const inField = (e: Event) => !!(e.target as HTMLElement).closest('input');

    const onDown = (e: PointerEvent) => {
      if (inField(e)) return;
      down = true;
      moved = false;
      long = false;
      clearTimeout(timer);
      if (get().onLongPress) {
        timer = setTimeout(() => {
          if (!down || moved) return;
          long = true;
          get().onLongPress?.();
        }, LONG_PRESS_MS);
      }
      sx = e.clientX;
      sy = e.clientY;
      last = get().position?.() ?? 0;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // egal: manche Browser lehnen das ab
      }
    };
    const onMove = (e: PointerEvent) => {
      const o = get();
      if (!down || !o.active()) return;
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return;
      if (long) return;
      if (!moved) el.dataset.turning = '';
      moved = true;
      clearTimeout(timer);
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
      if (o.onTurn) {
        last = positionForAngle(angle, last);
        o.onTurn(last);
      } else o.onStage(indexForAngle(angle, o.stageCount()));
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      clearTimeout(timer);
      delete el.dataset.turning;
      if (long) get().onLongRelease?.();
      else if (!moved) get().onTap();
    };
    const onCancel = () => {
      down = false;
      clearTimeout(timer);
      delete el.dataset.turning;
    };
    const onKey = (e: KeyboardEvent) => {
      if (inField(e)) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        get().onTap();
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    el.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('keydown', onKey);
    };
  };
}
