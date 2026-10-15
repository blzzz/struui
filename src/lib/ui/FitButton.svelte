<script lang="ts">
  /**
   * Lupe neben einer Reihe, die nicht auf eine Zeile passt (siehe `fit.ts`).
   * Mit − verkleinert sie auf eine Zeile, mit + zeigt sie die Originalgrösse.
   * Zurückhaltend wie die Schalter links vom Editor (TrackView): nur das Symbol, aus blass, an (Originalgrösse) weiss.
   * Die Höhe setzt die Reihe, in der der Knopf steht.
   */
  let { original, onclick }: { original: boolean; onclick: () => void } = $props();

  const label = $derived(original ? 'Auf eine Zeile verkleinern' : 'Originalgrösse');
</script>

<button class="fit" aria-pressed={original} aria-label={label} title={label} {onclick}>
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="6.5" cy="6.5" r="4.5" />
    <path d="M10 10l4.5 4.5M4.5 6.5h4" />
    {#if !original}<path d="M6.5 4.5v4" />{/if}
  </svg>
</button>

<style>
  .fit {
    flex: none;
    width: 28px;
    height: 28px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    color: var(--mute);
    background: transparent;
    opacity: 0.6;
  }
  .fit:hover {
    opacity: 1;
  }
  .fit[aria-pressed='true'] {
    background: transparent;
    color: var(--ink);
    opacity: 1;
  }
  @media (prefers-color-scheme: dark) {
    .fit[aria-pressed='true'] {
      color: #fff;
    }
  }
  svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
  }
</style>
