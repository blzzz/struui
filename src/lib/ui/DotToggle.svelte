<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * Kleiner Schalter an/aus: Punkt vor der Beschriftung, an gefüllt. Die Farbe kommt von `--mode-ink`
   * (sonst Schriftfarbe), so passt er zum Modus eines Effekts (ribbon) wie zur Notenspur (Relativ).
   */
  let {
    pressed,
    title,
    onclick,
    children,
  }: { pressed: boolean; title?: string; onclick: () => void; children: Snippet } = $props();
</script>

<button class="toggle" aria-pressed={pressed} {title} {onclick}>
  <span class="dot" aria-hidden="true"></span>{@render children()}
</button>

<style>
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 0;
    border: none;
    border-radius: 0;
    /* Ohne Fläche, auch gedrückt (sonst gälte der globale Stil für aria-pressed) */
    background: transparent;
    color: var(--mute);
    font: inherit;
    cursor: pointer;
  }
  .toggle:hover {
    color: var(--ink);
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1.2px currentColor;
  }
  .toggle[aria-pressed='true'] {
    color: var(--mode-ink, var(--ink));
  }
  .toggle[aria-pressed='true'] .dot {
    background: currentColor;
  }
</style>
