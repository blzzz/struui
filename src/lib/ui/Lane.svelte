<script lang="ts">
  import { wrapSpan } from '../domain/edit.ts';
  import { CLOSING } from '../domain/types.ts';
  import { project } from '../state/project.svelte.ts';
  import { session } from '../state/session.svelte.ts';
  import { flushSync } from 'svelte';
  import AddMenu from './AddMenu.svelte';
  import TokenColumn from './TokenColumn.svelte';
  import type { Token } from '../domain/types.ts';

  /**
   * Eine Steinreihe: die Klänge einer Spur oder die Werte eines Effekts (`value`).
   * Klänge kommen aus der Palette darunter (ziehen oder tippen), Werte und Noten über das + am Ende.
   * `readonly` (eingeklappte Spur): nur anzeigen und aufleuchten. Kein Tippen, Ziehen oder Ablegen, kein +.
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

  /** Notenreihe: das + am Ende hängt eine Note an. Klangreihen füllt die Palette. */
  const notes = $derived(!value && project.contentOf(laneId) === 'notes');

  function addNote() {
    const id = project.appendNote(laneId);
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

<div bind:this={row} class="row" data-lane={readonly ? undefined : laneId} data-lane-end={readonly ? undefined : tokens.length}>
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
      spanned={span !== null && i >= span[0] && i <= span[1]}
      error={parsed.errorIds.has(token.id)}
    />
  {/each}
  {#if !readonly}
    <div
      class="endcol"
      class:pluscol={value}
      class:notecol={notes}
      class:empty={tokens.length === 0 && !value && !notes}
      class:hint={endHint}
      data-drop-lane={laneId}
      data-drop-index={tokens.length}
      data-drop-kind="end"
    >
      {#if value}
        <AddMenu {laneId} />
      {:else if notes}
        <button class="plus" aria-label="Note anhängen" title="Note anhängen" onclick={addNote}>+</button>
      {:else if tokens.length === 0}
        Steine von unten hierher ziehen
      {/if}
    </div>
  {/if}
</div>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 0;
    align-items: flex-start;
  }
  .pluscol {
    padding-top: calc(var(--s) + 2px);
    padding-left: 2px;
  }
  /* + der Notenreihe: auf Höhe der Steine, über ihnen liegt die Zufallsreihe, wenn die Spur sie zeigt */
  .notecol {
    padding: calc(var(--s) + 2px) 0 0 4px;
  }
  :global(.norandom) .notecol {
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
  /* Ablage am Ende einer Klangreihe: so hoch wie eine Spalte (Würfel und Drehknöpfe nur, wenn die Spur sie zeigt),
     damit man dorthin ziehen kann. Eine leere Reihe ist gleich hoch, so springt sie beim ersten Stein nicht. */
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
  .endcol.pluscol {
    flex: none;
    min-height: 0;
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
