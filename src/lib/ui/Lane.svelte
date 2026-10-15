<script lang="ts">
  import { wrapSpan } from '../domain/edit.ts';
  import { CLOSING } from '../domain/types.ts';
  import { project } from '../state/project.svelte.ts';
  import { session } from '../state/session.svelte.ts';
  import { flushSync } from 'svelte';
  import TokenColumn from './TokenColumn.svelte';
  import type { Token } from '../domain/types.ts';

  /**
   * Eine Steinreihe: die Klänge einer Spur oder die Werte eines Effekts (`value`).
   * Klänge kommen aus der Klangpalette (ziehen), Werte und Noten über das + am Ende (hängt einen Stein an und öffnet sein Feld).
   * `readonly` (eingeklappte Spur): nur anzeigen und aufleuchten. Kein Tippen, Ziehen oder Ablegen, kein +.
   *
   * Passt die Reihe nicht auf eine Zeile, wird sie verkleinert (CSS `zoom`, bis `MIN_FIT`, darunter bricht sie wieder um).
   * Daneben erscheint dann ein Knopf für die Originalgrösse (`session.unfit`), dort einer zum Verkleinern.
   * Beim Tippen in einen Stein gilt Originalgrösse, sonst zoomt iOS ins zu kleine Eingabefeld.
   */
  let {
    laneId,
    tokens,
    value = false,
    readonly = false,
  }: { laneId: string; tokens: Token[]; value?: boolean; readonly?: boolean } = $props();

  const parsed = $derived(project.parsedOf(laneId));
  const endHint = $derived(session.dropHint?.laneId === laneId && session.dropHint.index === tokens.length);

  /** Umschliessen im Gang in dieser Reihe (im Steinmenü gewählt). */
  const wrap = $derived(session.wrap?.laneId === laneId ? session.wrap : null);
  /** Bereich, den das Paar fassen würde: vom Startstein bis zum Stein unter der Maus, angeschnittene Paare ganz. */
  const span = $derived.by(() => {
    if (!wrap) return null;
    const from = tokens.findIndex((t) => t.id === wrap.tokenId);
    if (from < 0) return null;
    const to = wrap.hoverId ? tokens.findIndex((t) => t.id === wrap.hoverId) : -1;
    return wrapSpan(tokens, from, to < 0 ? from : to);
  });
  let row = $state<HTMLElement>();
  let box = $state<HTMLElement>();

  /** Kleinste Verkleinerung, darunter wären die Steine kaum noch zu treffen. */
  const MIN_FIT = 0.5;
  /** Platz rechts vom letzten Stein einer Klangreihe, damit man dort ans Ende ablegen kann. */
  const END_WIDTH = 24;
  /** Verkleinerung, damit die Reihe auf eine Zeile passt (1 = passt in Originalgrösse). */
  let fit = $state(1);
  /** Die Reihe ist in Originalgrösse breiter als der Platz: nur dann gibt es den Knopf. */
  let overflows = $state(false);
  const original = $derived(session.unfit.has(laneId));
  const zoom = $derived(original ? 1 : fit);

  // Breite in Originalgrösse aus den Spalten messen (gezeichnete Breite durch den aktuellen Zoom) und mit dem Platz vergleichen
  $effect(() => {
    if (readonly || !row || !box) return;
    void tokens.map((t) => t.id);
    const el = row;
    const applied = zoom;
    const reserve = endcol ? 0 : END_WIDTH;
    const measure = () => {
      if (el.querySelector('input:focus')) return;
      let natural = reserve;
      for (const child of el.children) {
        if (child.classList.contains('wraphint')) continue;
        // Der Hinweis einer leeren Klangreihe füllt den Rest, es gibt nichts zu verkleinern
        if (child.classList.contains('empty')) continue;
        natural += child.getBoundingClientRect().width / applied;
      }
      const avail = el.getBoundingClientRect().width;
      overflows = natural > avail + 1;
      const next = overflows ? Math.max(MIN_FIT, Math.floor((avail / natural) * 100) / 100) : 1;
      if (Math.abs(next - fit) > 0.005) fit = next;
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
  });

  /** Notenreihe: das + am Ende hängt eine Note an, in einer Effektreihe einen Wert. Klangreihen füllt die Palette. */
  const notes = $derived(!value && project.contentOf(laneId) === 'notes');
  /**
   * Feld am Ende: + der Werte- und Notenreihen, Hinweis der leeren Klangreihe.
   * Eine Klangreihe mit Steinen hat keins. Dort legt die Reihe selbst am Ende ab (`data-lane-end`),
   * den Strich dafür zeichnet der letzte Stein rechts.
   */
  const endcol = $derived(!readonly && (value || notes || tokens.length === 0));

  function addStone() {
    const id = value ? project.appendValue(laneId) : project.appendNote(laneId);
    if (!id) return;
    session.editNew = id;
    // Noch in der Geste fokussieren, sonst öffnet iOS keine Tastatur
    flushSync();
  }

  // Tippen ausserhalb der Reihe oder Escape bricht ab
  $effect(() => {
    if (!wrap) return;
    const onDown = (e: PointerEvent) => {
      if (!row?.contains(e.target as Node)) session.wrap = null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') session.wrap = null;
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  });
</script>

<div class="lane" class:readonly bind:this={box}>
<div
  bind:this={row}
  class="row"
  style:--fit={zoom === 1 ? undefined : zoom}
  data-lane={readonly ? undefined : laneId}
  data-lane-end={readonly ? undefined : tokens.length}
>
  {#if wrap}
    <div class="wraphint" role="status">
      <span>{wrap.group} {CLOSING[wrap.group]} bis zu welchem Stein? Antippen.</span>
      <button onclick={() => (session.wrap = null)}>Abbrechen</button>
    </div>
  {/if}
  {#each tokens as token, i (token.id)}
    <TokenColumn
      {token}
      {laneId}
      {value}
      {readonly}
      index={i}
      last={!endcol && i === tokens.length - 1}
      spanned={span !== null && i >= span[0] && i <= span[1]}
      error={parsed.errorIds.has(token.id)}
    />
  {/each}
  {#if endcol}
    <div
      class="endcol"
      class:pluscol={value || notes}
      class:empty={!value && !notes}
      class:hint={endHint}
      data-drop-lane={laneId}
      data-drop-index={tokens.length}
      data-drop-kind="end"
    >
      {#if value || notes}
        {@const what = value ? 'Wert anhängen' : 'Note anhängen'}
        <button class="plus" aria-label={what} title={what} onclick={addStone}>+</button>
      {:else}
        Steine aus der Klangpalette hierher ziehen
      {/if}
    </div>
  {/if}
</div>
{#if !readonly && overflows}
  <button
    class="fit"
    aria-pressed={original}
    aria-label={original ? 'Auf eine Zeile verkleinern' : 'Originalgrösse'}
    title={original ? 'Auf eine Zeile verkleinern' : 'Originalgrösse'}
    onclick={() => session.toggleFit(laneId)}
  >
    <!-- Lupe: − verkleinert auf eine Zeile, + zeigt die Originalgrösse -->
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="4.5" />
      <path d="M10 10l4.5 4.5M4.5 6.5h4" />
      {#if !original}<path d="M6.5 4.5v4" />{/if}
    </svg>
  </button>
{/if}
</div>

<style>
  .lane {
    display: flex;
    align-items: flex-start;
    gap: 4px;
  }
  /* Eingeklappte Spur: die Reihe fügt sich in den Fluss der Spur ein */
  .lane.readonly {
    display: contents;
  }
  .row {
    flex: 1;
    min-width: 0;
    zoom: var(--fit, 1);
    display: flex;
    flex-wrap: wrap;
    gap: 6px 0;
    align-items: flex-start;
  }
  /* Beim Tippen in einen Stein Originalgrösse (iOS zoomt sonst ins Eingabefeld). Schlägt den Wert im style-Attribut. */
  .row:has(:global(input:focus)) {
    --fit: 1 !important;
  }
  /* Knopf für Original- bzw. verkleinerte Grösse, auf Höhe der Steine.
     Gleich zurückhaltend wie die Schalter links vom Editor (TrackView): nur das Symbol, aus blass, an weiss. */
  .fit {
    flex: none;
    width: 28px;
    height: 28px;
    margin-top: calc(var(--s) + 2px);
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
  :global(.norandom) .fit {
    margin-top: 0;
  }
  .fit svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
  }
  /* + der Noten- und Wertreihen: auf Höhe der Steine, über ihnen liegt die Zufallsreihe, wenn die Spur sie zeigt */
  .pluscol {
    padding: calc(var(--s) + 2px) 0 0 4px;
  }
  :global(.norandom) .pluscol {
    padding-top: 0;
  }
  .plus {
    width: var(--s);
    height: var(--s);
    padding: 0;
    border: 1.5px dashed var(--mute);
    color: var(--mute);
    border-radius: 8px;
    font-size: 22px;
    line-height: 1;
  }
  /* Feld am Ende (leere Klangreihe, + der Noten- und Wertreihen): so hoch wie eine Spalte (Würfel und Drehknöpfe nur,
     wenn die Spur sie zeigt). So springt eine leere Reihe beim ersten Stein nicht. */
  .endcol {
    flex: 1;
    min-width: 24px;
    min-height: calc(var(--s) * 3 + 4px);
  }
  :global(.norandom) .endcol,
  :global(.noknobs) .endcol {
    min-height: calc(var(--s) * 2 + 2px);
  }
  :global(.norandom.noknobs) .endcol {
    min-height: var(--s);
  }
  .endcol.empty {
    display: flex;
    align-items: center;
    padding: 0 12px;
    border: 1.5px dashed var(--line);
    border-radius: 8px;
    color: var(--mute);
    font-size: 13px;
  }
  .endcol.hint {
    box-shadow: inset 4px 0 0 0 var(--blue);
  }
  .wraphint {
    flex: 0 0 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: var(--blue);
  }
  .wraphint button {
    padding: 2px 10px;
    font-size: 13px;
    border-color: var(--line);
  }
  :global(.compact) .row {
    row-gap: 4px;
  }
</style>
