import type { Attachment } from 'svelte/attachments';

const callbacks = new WeakMap<Element, () => void>();
let observer: IntersectionObserver | null = null;

/** Ein gemeinsamer Beobachter für alle Elemente. Etwas Rand, damit knapp ausserhalb liegende Steine schon zählen. */
function shared(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        callbacks.get(entry.target)?.();
        // Einmal genügt: danach nicht mehr beobachten
        callbacks.delete(entry.target);
        observer?.unobserve(entry.target);
      }
    },
    { rootMargin: '100px' },
  );
  return observer;
}

/**
 * Ruft `onVisible` einmal auf, sobald das Element in den sichtbaren Bereich kommt (auch beim Verschieben und Zoomen des
 * Boards). Hängt die Attachment-Funktion an einem Wert, beginnt das Beobachten bei dessen Änderung von vorn.
 */
export function onceVisible(onVisible: () => void): Attachment<HTMLElement> {
  return (el) => {
    callbacks.set(el, onVisible);
    shared().observe(el);
    return () => {
      callbacks.delete(el);
      observer?.unobserve(el);
    };
  };
}
