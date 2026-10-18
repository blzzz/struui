<script lang="ts">
  import { wrapSpan } from '../domain/edit.ts';
  import { CLOSING, joinsPrevious } from '../domain/types.ts';
  import { project } from '../state/project.svelte.ts';
  import { session } from '../state/session.svelte.ts';
  import { flushSync } from 'svelte';
  import FitButton from './FitButton.svelte';
  import TokenColumn from './TokenColumn.svelte';
  import { watchFit } from './fit.ts';
  import type { Token } from '../domain/types.ts';

  /**
   * Eine Steinreihe: die Klänge einer Spur oder die Werte eines Effekts (`value`).
   * Klänge kommen aus der Klangpalette (ziehen), Werte und Noten über das + am Ende (hängt einen Stein an und öffnet sein Feld).
   *
   * Passt eine Klangreihe nicht auf eine Zeile, wird sie verkleinert (`fit.ts`, bis `MIN_FIT`, darunter bricht sie wieder um).
   * Daneben erscheint dann ein Knopf für die Originalgrösse (`session.unfit`), dort einer zum Verkleinern.
   * Noten- und Wertreihen bleiben in Originalgrösse und brechen um.
   * Die Reihe bleibt auch beim Tippen in einen Stein verkleinert, nur sein Feld hat normale Grösse (`TokenStone`).
   */
  let {
    laneId,
    tokens,
    value = false,
  }: { laneId: string; tokens: Token[]; value?: boolean } = $props();

  const parsed = $derived(project.parsedOf(laneId));
  const endHint = $derived(
    session.dropHint?.laneId === laneId && session.dropHint.mode === 'insert' && session.dropHint.index === tokens.length,
  );

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

  /** Nur Reihen aus Klangsteinen lassen sich verkleinern. */
  const fittable = $derived(project.contentOf(laneId) === 'sounds');
  /** Verkleinerung, damit die Reihe auf eine Zeile passt (1 = passt in Originalgrösse). */
  let fit = $state(1);
  /** Die Reihe ist in Originalgrösse breiter als der Platz: nur dann gibt es den Knopf. */
  let overflows = $state(false);
  const original = $derived(session.unfit.has(laneId));
  const zoom = $derived(!fittable || original ? 1 : fit);

  $effect(() => {
    if (!row || !fittable) {
      overflows = false;
      return;
    }
    void tokens.map((t) => t.id);
    const applied = zoom;
    return watchFit(
      row,
      applied,
      (r) => {
        overflows = r.overflows;
        if (Math.abs(r.fit - fit) > 0.005) fit = r.fit;
      },
      (child) => {
        // Der Hinweis einer leeren Klangreihe füllt den Rest, es gibt nichts zu verkleinern
        if (child.classList.contains('wraphint') || child.classList.contains('empty')) return null;
        // Das Feld mit dem + dehnt sich, es zählt nur bis zum rechten Rand des Knopfs
        const plus = child.classList.contains('pluscol') ? child.querySelector<HTMLElement>('.plus') : null;
        return plus ? plus.offsetLeft - child.offsetLeft + plus.offsetWidth : child.offsetWidth;
      },
    );
  });

  /** Notenreihe: das + am Ende hängt eine Note an, in einer Effektreihe einen Wert. Klangreihen füllt die Palette. */
  const notes = $derived(!value && project.contentOf(laneId) === 'notes');
  /**
   * Feld am Ende: + der Werte- und Notenreihen, Hinweis der leeren Klangreihe.
   * Eine Klangreihe mit Steinen hat keins. Dort legt die Reihe selbst am Ende ab (`data-lane-end`),
   * den Strich dafür zeichnet der letzte Stein rechts.
   */
  const endcol = $derived(value || notes || tokens.length === 0);

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

<div class="lane">
<div
  bind:this={row}
  class="row"
  style:--fit={zoom === 1 ? undefined : zoom}
  data-lane={laneId}
  data-lane-end={tokens.length}
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
      index={i}
      last={!endcol && i === tokens.length - 1}
      stackPrev={joinsPrevious(tokens, i)}
      stackNext={joinsPrevious(tokens, i + 1)}
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
{#if overflows}
  <FitButton {original} onclick={() => session.toggleFit(laneId)} />
{/if}
</div>

<style>
  .lane {
    display: flex;
    align-items: flex-start;
    gap: 4px;
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
  /* Lupe auf Höhe der Steine, über ihnen liegt die Zufallsreihe, wenn die Spur sie zeigt */
  .lane > :global(.fit) {
    margin-top: calc(var(--s) + 2px);
  }
  :global(.norandom) .lane > :global(.fit) {
    margin-top: 0;
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
</style>
