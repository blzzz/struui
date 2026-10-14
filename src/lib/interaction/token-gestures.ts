import type { Attachment } from 'svelte/attachments';

export interface DropTarget {
  /** Steinreihe: Spur oder Effekt. */
  laneId: string;
  /** Einfügeposition in der Zielreihe, bei `replace` die Position des Steins, der ersetzt wird. */
  index: number;
  /** Über der Mitte eines Klangsteins losgelassen: ihn ersetzen statt davor oder danach einfügen. */
  replace: boolean;
}

export interface TokenGestureOptions {
  onTap(): void;
  onDoubleTap(): void;
  /**
   * Tippen sofort melden, ohne auf einen zweiten Tipp zu warten (Doppeltippen gibt es dann nicht).
   * Nötig, wenn das Tippen ein Eingabefeld fokussiert: iOS öffnet die Tastatur nur innerhalb der Geste.
   */
  immediateTap?: boolean;
  /** Langes Drücken ohne Bewegung. Fehlt es, passiert beim langen Drücken nichts Besonderes. */
  onLongPress?(): void;
  /**
   * Ob eine Bewegung (ab der Schwelle) ein Ziehen startet. Sonst wird die Geste aufgegeben und der Browser darf scrollen,
   * z. B. in einer waagrecht scrollbaren Zeile: nur senkrechte Bewegungen ziehen. Fehlt es, zieht jede Bewegung.
   * Gilt nur für Touch: Mit Maus oder Stift scrollt der Browser beim Ziehen nicht, dort zieht jede Richtung.
   */
  canDrag?(dx: number, dy: number): boolean;
  /** Darf über der Mitte eines Klangsteins ersetzen (Steine aus der Palette). Sonst wird immer eingefügt. */
  replaces?: boolean;
  onDragMove(target: DropTarget | null): void;
  onDrop(target: DropTarget | null): void;
}

const DOUBLE_TAP_MS = 260;
const LONG_PRESS_MS = 450;
const DRAG_THRESHOLD = 8;

/**
 * Sucht unter dem Finger die Steinreihe und die Einfügeposition (Markierung per data-Attribute).
 * Mit `replace` gilt die mittlere Hälfte eines ersetzbaren Steins (`data-drop-replaceable`) als «ersetzen»,
 * die äusseren Viertel als «davor» bzw. «danach einfügen». Sonst entscheidet die Hälfte.
 */
export function findDropTarget(x: number, y: number, replace = false): DropTarget | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const cell = el.closest<HTMLElement>('[data-drop-lane]');
  if (cell) {
    const laneId = cell.dataset.dropLane as string;
    let index = Number(cell.dataset.dropIndex);
    if (cell.dataset.dropKind === 'col') {
      const r = cell.getBoundingClientRect();
      const at = (x - r.left) / r.width;
      if (replace && cell.dataset.dropReplaceable === 'true' && at > 0.25 && at < 0.75) return { laneId, index, replace: true };
      if (at > 0.5) index += 1;
    }
    return { laneId, index, replace: false };
  }
  const lane = el.closest<HTMLElement>('[data-lane]');
  if (lane) return { laneId: lane.dataset.lane as string, index: Number(lane.dataset.laneEnd), replace: false };
  return null;
}

const sameTarget = (a: DropTarget | null, b: DropTarget | null): boolean =>
  a === b || (a !== null && b !== null && a.laneId === b.laneId && a.index === b.index && a.replace === b.replace);

/**
 * Tippen, Doppeltippen, langes Drücken und Ziehen auf einem Stein.
 * Das Einzeltippen wird um DOUBLE_TAP_MS verzögert, damit ein zweiter Tipp erkannt werden kann (ausser bei `immediateTap`).
 *
 * Nach dem Drücken hört die Geste am ganzen Fenster zu, nicht nur am Stein. Sonst kann das Loslassen verloren gehen
 * (Umleitung der Zeigerereignisse verloren, Element neu gezeichnet, ausserhalb losgelassen) und der Geisterstein bleibt hängen.
 * Bewegungen werden höchstens einmal pro Bild ausgewertet, die Einfügestelle nur bei einer Änderung gemeldet.
 */
export function tokenGestures(get: () => TokenGestureOptions): Attachment<HTMLElement> {
  return (el) => {
    let pointerId: number | null = null;
    let moved = false;
    let sx = 0;
    let sy = 0;
    let ghost: HTMLElement | null = null;
    let target: DropTarget | null = null;
    let tapTimer: number | undefined;
    let pressTimer: number | undefined;
    let pressed = false;
    let frame: number | undefined;
    let last: PointerEvent | null = null;

    /** Geste beenden: Fensterlauscher weg, Geist weg. */
    const release = () => {
      pointerId = null;
      window.clearTimeout(pressTimer);
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      last = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('blur', onCancel);
      window.removeEventListener('keydown', onEscape, true);
      ghost?.remove();
      ghost = null;
      el.classList.remove('dragging');
    };

    const onDown = (e: PointerEvent) => {
      // Eingabefeld und Knöpfe im Stein bedienen sich selbst; nur die Haupttaste
      if ((e.target as HTMLElement).closest('input, button') || e.button !== 0) return;
      if (pointerId !== null) release();
      pointerId = e.pointerId;
      moved = false;
      pressed = false;
      target = null;
      sx = e.clientX;
      sy = e.clientY;
      if (get().onLongPress) {
        pressTimer = window.setTimeout(() => {
          pressed = true;
          get().onLongPress?.();
        }, LONG_PRESS_MS);
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('blur', onCancel);
      window.addEventListener('keydown', onEscape, true);
    };

    const startDrag = (e: PointerEvent): boolean => {
      if (Math.hypot(e.clientX - sx, e.clientY - sy) < DRAG_THRESHOLD) return false;
      if (e.pointerType === 'touch' && get().canDrag?.(e.clientX - sx, e.clientY - sy) === false) {
        // Der Browser scrollt, die Geste gibt auf
        release();
        return false;
      }
      moved = true;
      window.clearTimeout(pressTimer);
      window.clearTimeout(tapTimer);
      tapTimer = undefined;
      const rect = el.getBoundingClientRect();
      ghost = el.cloneNode(true) as HTMLElement;
      ghost.classList.add('ghost');
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      document.body.append(ghost);
      el.classList.add('dragging');
      return true;
    };

    /** Höchstens einmal pro Bild: Geist bewegen, Ziel suchen. */
    const update = () => {
      frame = undefined;
      const e = last;
      if (!e || !ghost) return;
      ghost.style.left = `${e.clientX - ghost.offsetWidth / 2}px`;
      ghost.style.top = `${e.clientY - ghost.offsetHeight / 2}px`;
      const next = findDropTarget(e.clientX, e.clientY, get().replaces ?? false);
      if (!sameTarget(next, target)) {
        target = next;
        get().onDragMove(target);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      if (!moved && !startDrag(e)) return;
      if (e.cancelable) e.preventDefault();
      last = e;
      frame ??= requestAnimationFrame(update);
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const wasMoved = moved;
      const wasPressed = pressed;
      if (wasMoved && last) {
        // Letzte Position noch auswerten, falls das Bild nicht mehr kam
        last = e;
        update();
      }
      const t = target;
      release();
      if (wasPressed) return;
      if (wasMoved) {
        get().onDragMove(null);
        get().onDrop(t);
        return;
      }
      if (get().immediateTap) {
        get().onTap();
      } else if (tapTimer !== undefined) {
        window.clearTimeout(tapTimer);
        tapTimer = undefined;
        get().onDoubleTap();
      } else {
        tapTimer = window.setTimeout(() => {
          tapTimer = undefined;
          get().onTap();
        }, DOUBLE_TAP_MS);
      }
    };

    const onCancel = () => {
      const wasMoved = moved;
      release();
      if (wasMoved) get().onDragMove(null);
    };

    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && moved) {
        e.stopPropagation();
        onCancel();
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, button')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        get().onDoubleTap();
      } else if (e.key === ' ') {
        e.preventDefault();
        get().onTap();
      }
    };
    // Langes Drücken soll kein Kontextmenü öffnen (Android, Desktop)
    const onMenu = (e: Event) => {
      if (get().onLongPress) e.preventDefault();
    };
    // Kein natives Ziehen (Text, Bilder) des Browsers, das unsere Geste abbrechen würde
    const onNativeDrag = (e: Event) => e.preventDefault();

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('keydown', onKey);
    el.addEventListener('contextmenu', onMenu);
    el.addEventListener('dragstart', onNativeDrag);
    return () => {
      window.clearTimeout(tapTimer);
      // Wird der Stein während des Ziehens entfernt, die Einfügemarke nicht stehen lassen
      if (moved && pointerId !== null) get().onDragMove(null);
      release();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('contextmenu', onMenu);
      el.removeEventListener('dragstart', onNativeDrag);
    };
  };
}
