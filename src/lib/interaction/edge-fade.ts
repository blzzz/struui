import type { Attachment } from 'svelte/attachments';

/**
 * Blendet eine waagrecht scrollbare Zeile an den Rändern aus, solange es dort noch weitergeht.
 * Setzt `fade-l` und `fade-r`, die Maske selbst steht in `app.css` (Klasse `edge-fade`).
 */
export const edgeFade: Attachment<HTMLElement> = (el) => {
  el.classList.add('edge-fade');
  const update = () => {
    const max = el.scrollWidth - el.clientWidth;
    el.classList.toggle('fade-l', el.scrollLeft > 1);
    el.classList.toggle('fade-r', el.scrollLeft < max - 1);
  };
  update();
  el.addEventListener('scroll', update, { passive: true });
  // Breite der Box und Inhalt ändern sich auch ohne Scrollen
  const resize = new ResizeObserver(update);
  resize.observe(el);
  const mutate = new MutationObserver(update);
  mutate.observe(el, { childList: true, subtree: true });
  return () => {
    el.removeEventListener('scroll', update);
    resize.disconnect();
    mutate.disconnect();
  };
};
