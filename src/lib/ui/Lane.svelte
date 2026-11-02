<script lang="ts">
  import { wrapSpan } from "../domain/edit.ts";
  import { CLOSING, joinsPrevious } from "../domain/types.ts";
  import { project } from "../state/project.svelte.ts";
  import { session } from "../state/session.svelte.ts";
  import { flushSync } from "svelte";
  import FitButton from "./FitButton.svelte";
  import TokenColumn from "./TokenColumn.svelte";
  import { watchFit } from "./fit.ts";
  import type { Token } from "../domain/types.ts";
  import type { Snippet } from "svelte";

  /**
   * Eine Steinreihe: die Klänge einer Spur oder die Werte eines Effekts (`value`).
   * Klänge kommen aus der Klangpalette (ziehen), Werte und Noten über das + am Ende (hängt einen Stein an und öffnet sein Feld).
   *
   * Passt eine Klang- oder Notenreihe nicht auf eine Zeile, wird sie verkleinert (`fit.ts`, bis `MIN_FIT`, darunter bricht sie wieder um).
   * Daneben erscheint dann ein Knopf für die Originalgrösse (`session.unfit`), dort einer zum Verkleinern.
   * Wertreihen bleiben in Originalgrösse und brechen um.
   * Die Reihe bleibt auch beim Tippen in einen Stein verkleinert, nur sein Feld hat normale Grösse (`TokenStone`).
   */
  /** `lead`: steht vorne in der Reihe, vor den Steinen (die Parameter der Paramlocks). */
  let {
    laneId,
    tokens,
    value = false,
    lead,
  }: { laneId: string; tokens: Token[]; value?: boolean; lead?: Snippet } =
    $props();

  const parsed = $derived(project.parsedOf(laneId));
  /** Paramlocks: die Steine sind so hoch wie ihre Teile übereinander, je Parameter eine Zeile (`--lock-row`). */
  const lockCount = $derived(project.lane(laneId)?.locks?.params.length ?? 0);
  const endHint = $derived(
    session.dropHint?.laneId === laneId &&
      session.dropHint.mode === "insert" &&
      session.dropHint.index === tokens.length,
  );

  /** Auswahl im Gang in dieser Reihe (im Steinmenü mit «Auswählen» begonnen). */
  const selection = $derived(
    session.selection?.laneId === laneId ? session.selection : null,
  );
  /** Ausgewählter Bereich: vom Startstein bis zum zuletzt angetippten, angeschnittene Paare und Stapel ganz. */
  const span = $derived.by(() => {
    if (!selection) return null;
    const from = tokens.findIndex((t) => t.id === selection.fromId);
    if (from < 0) return null;
    const to = tokens.findIndex((t) => t.id === selection.toId);
    return wrapSpan(tokens, from, to < 0 ? from : to);
  });
  const count = $derived(span ? span[1] - span[0] + 1 : 0);

  /** Operation auf der Auswahl ausführen, danach ist sie vorbei. */
  function onSelection(op: (from: string, to: string) => void) {
    const sel = selection;
    session.selection = null;
    if (sel) op(sel.fromId, sel.toId);
  }
  let row = $state<HTMLElement>();
  let lane = $state<HTMLElement>();
  let bar = $state<HTMLElement>();

  /**
   * Lage der schwebenden Leiste: mittig über dem ausgewählten Bereich (bzw. dem Startstein), in Bildschirmpunkten relativ
   * zur Reihe. `zoom` hebt Verkleinerungen darüber auf (`--fit`), damit die Leiste in normaler Grösse erscheint
   * und `left`/`top` Bildschirmpunkte bleiben. Waagrecht innerhalb der Reihe gehalten.
   */
  let barPos = $state<{ left: number; top: number; zoom: number } | null>(null);
  $effect(() => {
    if (!span || !row || !lane || !bar) {
      barPos = null;
      return;
    }
    void zoom;
    void selection?.chosen;
    const place = () => {
      if (!row || !lane || !bar) return;
      const spanned = row.querySelectorAll<HTMLElement>(".slot.spanned");
      if (spanned.length === 0) return;
      const box = lane.getBoundingClientRect();
      // Verkleinerung darüber: Bildschirmpunkte je CSS-Punkt der Reihe
      const scale = lane.offsetWidth ? box.width / lane.offsetWidth : 1;
      let left = Infinity;
      let right = -Infinity;
      let top = Infinity;
      for (const el of spanned) {
        const r = el.getBoundingClientRect();
        left = Math.min(left, r.left);
        right = Math.max(right, r.right);
        top = Math.min(top, r.top);
      }
      const half = bar.offsetWidth / 2;
      const center = Math.min(
        Math.max((left + right) / 2 - box.left, half),
        Math.max(box.width - half, half),
      );
      barPos = { left: center, top: top - box.top, zoom: 1 / scale };
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(row);
    ro.observe(bar);
    return () => ro.disconnect();
  });

  /** Nur Reihen aus Klang- und Notensteinen lassen sich verkleinern. */
  const fittable = $derived(
    project.contentOf(laneId) === "sounds" || project.contentOf(laneId) === "notes",
  );
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
    // Hängt nicht vom angewandten Zoom ab (gemessen wird ohne), sonst baute jede Änderung die Messung neu auf
    return watchFit(
      row,
      (r) => {
        overflows = r.overflows;
        if (Math.abs(r.fit - fit) > 0.005) fit = r.fit;
      },
      (child) => {
        // Der Hinweis einer leeren Klangreihe füllt den Rest, es gibt nichts zu verkleinern
        if (child.classList.contains("empty")) return null;
        // Das Feld mit dem + dehnt sich, es zählt nur bis zum rechten Rand des Knopfs
        const plus = child.classList.contains("pluscol")
          ? child.querySelector<HTMLElement>(".plus")
          : null;
        return plus
          ? plus.offsetLeft - child.offsetLeft + plus.offsetWidth
          : child.offsetWidth;
      },
    );
  });

  /** Notenreihe: das + am Ende hängt eine Note an, in einer Effektreihe einen Wert. Klangreihen füllt die Palette. */
  const notes = $derived(!value && project.contentOf(laneId) === "notes");
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

  // Tippen ausserhalb der Reihe und ihrer Leiste oder Escape beendet die Auswahl.
  // Mit dem Weg des Ereignisses statt `contains`: «Auswählen» löst schon beim Aufsetzen aus, das Menü ist weg, bevor dasselbe
  // Ereignis hier ankommt, und der entfernte Knopf läge sonst «ausserhalb»
  $effect(() => {
    if (!selection) return;
    const onDown = (e: PointerEvent) => {
      const path = e.composedPath();
      if (row && !path.includes(row) && !(bar && path.includes(bar)))
        session.selection = null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") session.selection = null;
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  });
</script>

<div
  class="lane"
  class:values={value}
  style:--sh={lockCount > 0
    ? `calc(${lockCount} * var(--lock-row) + 2 * var(--lock-pad))`
    : undefined}
  bind:this={lane}
>
  <div
    bind:this={row}
    class="row"
    style:--fit={zoom === 1 ? undefined : zoom}
    data-lane={laneId}
    data-lane-end={tokens.length}
  >
    {@render lead?.()}
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
        selectable={tokens.length > 1}
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
          {@const what = value ? "Wert anhängen" : "Note anhängen"}
          <button class="plus" aria-label={what} title={what} onclick={addStone}
            >+</button
          >
        {:else}
          Steine aus der Klangpalette hierher ziehen
        {/if}
      </div>
    {/if}
  </div>
  {#if selection}
    <!-- Auswahl: schwebt über dem Bereich. Zuerst die Aufforderung, erst nach dem Antippen des Endes die Knöpfe. -->
    <div
      bind:this={bar}
      class="selbar"
      class:placed={barPos !== null}
      style:left={barPos ? `${barPos.left}px` : null}
      style:top={barPos ? `${barPos.top}px` : null}
      style:zoom={barPos && barPos.zoom !== 1 ? barPos.zoom : null}
      role="toolbar"
      aria-label="Auswahl"
    >
      {#if !selection.chosen}
        <span class="what" role="status">Selektionsende antippen</span>
      {:else}
        {#each ["[", "<", "{"] as const as g, i (g)}
          <button
            class="wrapstone br{i + 1}"
            aria-label={`Mit ${g} ${CLOSING[g]} umschliessen`}
            title={`Mit ${g} ${CLOSING[g]} umschliessen`}
            onclick={() =>
              onSelection((a, b) => project.wrapRange(laneId, a, b, g))}
            >{g}&#8239;{CLOSING[g]}</button
          >
        {/each}
        <button
          class="icon"
          aria-label="Auswahl verdoppeln"
          title="Auswahl verdoppeln"
          onclick={() =>
            onSelection((a, b) => project.duplicateRange(laneId, a, b))}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"
            ><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" /><path
              d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"
            /></svg
          >
        </button>
        <button
          class="icon"
          aria-label="Auswahl entfernen"
          title="Auswahl entfernen"
          onclick={() =>
            onSelection((a, b) => project.removeRange(laneId, a, b))}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"
            ><path
              d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5M7 7v4M9 7v4"
            /></svg
          >
        </button>
        <button
          class="icon"
          aria-label="Abbrechen"
          title="Abbrechen"
          onclick={() => (session.selection = null)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"
            ><path d="M4 4l8 8M12 4l-8 8" /></svg
          >
        </button>
      {/if}
    </div>
  {/if}
  {#if overflows}
    <FitButton {original} onclick={() => session.toggleFit(laneId)} />
  {/if}
</div>

<style>
  .lane {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 4px;
  }
  /* Wertsteine: so hoch wie die Zahlenfelder der Effekt-Box (`--field-h`) */
  .lane.values {
    --sh: var(--field-h);
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
    height: var(--sh, var(--s));
    padding: 0;
    border: 1.5px dashed var(--mute);
    color: var(--mute);
    border-radius: 8px;
    font-size: 22px;
    line-height: 1;
  }
  /* Bei Wertsteinen (Notation in der Effekt-Box) quadratisch, so hoch wie die Steine */
  .lane.values .plus {
    width: var(--sh);
  }
  /* Feld am Ende (leere Klangreihe, + der Noten- und Wertreihen): so hoch wie eine Spalte (Würfel und Drehknöpfe nur,
     wenn die Spur sie zeigt). So springt eine leere Reihe beim ersten Stein nicht. */
  .endcol {
    flex: 1;
    min-width: 24px;
    min-height: calc(var(--s) * 2 + var(--sh, var(--s)) + 4px);
  }
  :global(.norandom) .endcol,
  :global(.noknobs) .endcol {
    min-height: calc(var(--s) + var(--sh, var(--s)) + 2px);
  }
  :global(.norandom.noknobs) .endcol {
    min-height: var(--sh, var(--s));
  }
  .endcol.empty {
    display: flex;
    align-items: center;
    padding: 0 12px;
    border: 1.5px dashed var(--line);
    border-radius: 8px;
    color: var(--mute);
    font-size: 13px;
    text-align: center;
  }
  .endcol.hint {
    box-shadow: inset 4px 0 0 0 var(--blue);
  }
  /* Leiste der Auswahl: schwebt mittig über dem Bereich, verschiebt nichts. Unsichtbar, bis ihre Lage gemessen ist. */
  .selbar {
    position: absolute;
    left: 0;
    top: 0;
    transform: translate(-50%, calc(-100% - 8px));
    z-index: 30;
    visibility: hidden;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px;
    background: var(--panel);
    border: 1.5px solid var(--line);
    border-radius: 12px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
    white-space: nowrap;
  }
  .selbar.placed {
    visibility: visible;
  }
  .selbar .what {
    padding: 6px 10px;
    color: var(--blue);
    font-size: 14px;
    font-weight: 500;
  }
  .selbar button {
    height: 44px;
    padding: 0;
    border: none;
  }
  .selbar .wrapstone {
    padding: 0 12px;
    border-radius: 9px;
    color: #fff;
    font-size: 18px;
    font-weight: 500;
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.25);
  }
  .selbar .br1 {
    background: var(--br1);
  }
  .selbar .br2 {
    background: var(--br2);
  }
  .selbar .br3 {
    background: var(--br3);
  }
  .selbar .icon {
    width: 44px;
    display: grid;
    place-items: center;
  }
  .selbar svg {
    width: 24px;
    height: 24px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
