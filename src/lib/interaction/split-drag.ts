import type { Attachment } from 'svelte/attachments';

export interface SplitDragOptions {
  /** Nur dann zieht die Geste (senkrechter Strich); sonst bleibt alles beim Klick. */
  active(): boolean;
  /** Die Hülle mit beiden Seiten und dem Trenner dazwischen. */
  container(): HTMLElement | null;
  /** Anteil der linken Seite am Platz neben dem Trenner (0–1). */
  onRatio(ratio: number): void;
}

/** Ab so vielen Pixeln wird aus dem Drücken ein Ziehen. */
const THRESHOLD = 4;
/** Keine Seite wird schmaler als dieser Anteil. */
const MIN = 0.15;

/**
 * Ziehen am Trenner (Strich oder Knopf darauf) teilt den Platz zwischen linker und rechter Seite neu auf.
 * Mit Seitenverhältnissen der Bildschirmlage, die Verkleinerung der Arbeitsfläche (`scale`) spielt so keine Rolle.
 * Nach einem Ziehen wird der folgende Klick verschluckt, damit der Knopf auf dem Strich nicht umschaltet.
 * Wie die anderen Gesten hört sie nach dem Drücken am ganzen Fenster zu und endet bei `pointercancel` oder `Escape`.
 */
export function splitDrag(get: () => SplitDragOptions): Attachment<HTMLElement> {
  return (handle) => {
    let sx = 0;
    let dragging = false;

    const stop = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', stop);
      delete handle.dataset.dragging;
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging) {
        if (Math.abs(e.clientX - sx) < THRESHOLD) return;
        dragging = true;
        handle.dataset.dragging = '';
      }
      e.preventDefault();
      const box = get().container()?.getBoundingClientRect();
      if (!box) return;
      const self = handle.getBoundingClientRect();
      const room = box.width - self.width;
      if (room <= 0) return;
      const ratio = (e.clientX - box.left - self.width / 2) / room;
      get().onRatio(Math.min(Math.max(ratio, MIN), 1 - MIN));
    };
    const onUp = () => stop();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop();
    };
    const onClick = (e: MouseEvent) => {
      if (!dragging) return;
      dragging = false;
      e.stopPropagation();
      e.preventDefault();
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !get().active()) return;
      sx = e.clientX;
      dragging = false;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', stop);
      window.addEventListener('keydown', onKey);
      window.addEventListener('blur', stop);
    };

    handle.addEventListener('pointerdown', onDown);
    // In der Einfangphase, damit der Klick den Knopf auf dem Strich nach einem Ziehen nicht erreicht
    handle.addEventListener('click', onClick, true);
    return () => {
      handle.removeEventListener('pointerdown', onDown);
      handle.removeEventListener('click', onClick, true);
      stop();
    };
  };
}
