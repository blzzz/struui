import type { Attachment } from 'svelte/attachments';
import { indexForAngle } from '../domain/scales.ts';

export interface KnobOptions {
  /** Ist der Knopf eingeschaltet (nur dann lässt er sich drehen)? */
  active(): boolean;
  stageCount(): number;
  onTap(): void;
  onStage(index: number): void;
}

/**
 * Tippen schaltet, Ziehen im Bogen um die Mitte dreht (rastet auf Stufen).
 * Die Optionen werden erst im Ereignis gelesen, damit die Anbindung nicht neu aufgebaut wird.
 * Während des Drehens trägt das Element `data-turning` (zum Hervorheben per CSS).
 */
export function knob(get: () => KnobOptions): Attachment<HTMLElement> {
  return (el) => {
    let down = false;
    let moved = false;
    let sx = 0;
    let sy = 0;

    const onDown = (e: PointerEvent) => {
      down = true;
      moved = false;
      sx = e.clientX;
      sy = e.clientY;
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
      if (!moved) el.dataset.turning = '';
      moved = true;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
      o.onStage(indexForAngle(angle, o.stageCount()));
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      delete el.dataset.turning;
      if (!moved) get().onTap();
    };
    const onCancel = () => {
      down = false;
      delete el.dataset.turning;
    };
    const onKey = (e: KeyboardEvent) => {
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
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('keydown', onKey);
    };
  };
}
