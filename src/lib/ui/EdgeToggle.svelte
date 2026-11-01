<script lang="ts">
  /**
   * Kante über die ganze Breite, die einen Bereich auf- und zuklappt (Leiste oben, Szenen-Leiste unten). Wie die rechte Kante
   * der Effekt-Boxen (`EffectBox`): immer leicht getönt, beim Zeigen und offen kräftiger, mit Pfeil in die Richtung, in die der
   * Bereich beim Klick geht. `at`: wo die Kante am Bereich liegt (`bottom` unter der Leiste oben, `top` über der Leiste unten).
   * `hot`: der Zeiger ist über dem Bereich, dessen Klick ebenfalls klappt.
   */
  let {
    open,
    at,
    label,
    controls,
    hot = false,
    onclick,
  }: {
    open: boolean;
    at: "top" | "bottom";
    label: string;
    controls: string;
    hot?: boolean;
    onclick: () => void;
  } = $props();

  /** Unten an der Leiste oben öffnet der Bereich nach unten, oben an der Leiste unten nach oben. */
  const down = $derived(at === "bottom" ? !open : open);
</script>

<button
  class="edge"
  class:hot
  class:top={at === "top"}
  aria-expanded={open}
  aria-controls={controls}
  aria-label={label}
  title={label}
  {onclick}
>
  <svg viewBox="0 0 16 8" aria-hidden="true"
    ><path d={down ? "M4 2.5l4 3 4-3" : "M4 5.5L8 2.5l4 3"} /></svg
  >
</button>

<style>
  /* Trennlinie zum Inhalt: unter der Leiste oben darüber, über der Leiste unten darunter */
  .edge {
    --edge-ink: var(--ink);
    flex: none;
    width: 100%;
    height: 18px;
    display: grid;
    place-items: center;
    padding: 0;
    border: none;
    border-top: 1px solid color-mix(in srgb, var(--edge-ink) 25%, transparent);
    border-radius: 0;
    background: color-mix(in srgb, var(--edge-ink) 10%, transparent);
    color: color-mix(in srgb, var(--edge-ink) 70%, transparent);
    cursor: pointer;
  }
  .edge.top {
    border-top: none;
    border-bottom: 1px solid
      color-mix(in srgb, var(--edge-ink) 25%, transparent);
  }
  .edge.hot,
  .edge:hover,
  .edge:focus-visible {
    border-color: color-mix(in srgb, var(--edge-ink) 55%, transparent);
    background: color-mix(in srgb, var(--edge-ink) 22%, transparent);
    color: var(--edge-ink);
    outline: none;
  }
  .edge[aria-expanded="true"] {
    border-color: color-mix(in srgb, var(--edge-ink) 45%, transparent);
    background: color-mix(in srgb, var(--edge-ink) 18%, transparent);
    color: var(--edge-ink);
  }
  svg {
    width: 16px;
    height: 8px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
