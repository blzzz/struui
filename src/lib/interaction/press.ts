import type { Attachment } from 'svelte/attachments';

/**
 * Knopf, der schon beim Aufsetzen auslöst und dem Eingabefeld den Fokus lässt (Menü und −/+ eines Steins beim Bearbeiten).
 *
 * Mit `click` allein geht das auf Touch schief: Der Browser verschiebt beim Tippen den Fokus, das Feld verliert ihn,
 * `blur` schliesst Menü und Knöpfe, und der Klick kommt nie an. `preventDefault` auf `pointerdown` verhindert den
 * Fokuswechsel nur bei der Maus, auf Touch braucht es `touchstart` (das unterdrückt auch den Klick, deshalb hier auslösen).
 * Tastatur (Enter, Leertaste) kommt weiter als `click` ohne Zeiger (`detail` 0).
 */
export function press(action: () => void): Attachment<HTMLElement> {
  return (el) => {
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      action();
    };
    const onTouch = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      if (e.detail === 0) action();
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('touchstart', onTouch, { passive: false });
    el.addEventListener('click', onClick);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('touchstart', onTouch);
      el.removeEventListener('click', onClick);
    };
  };
}
