<script lang="ts">
  import { flip } from "svelte/animate";
  import {
    searchEffects,
    searchNoteOps,
    singleValue,
    valueInfo,
  } from "../domain/effects.ts";
  import type { EffectInfo } from "../domain/effects.ts";
  import { project } from "../state/project.svelte.ts";
  import type { RowKind } from "../state/project.svelte.ts";
  import { session } from "../state/session.svelte.ts";
  import { reorder } from "../interaction/reorder.ts";
  import EffectBox from "./EffectBox.svelte";
  import FitButton from "./FitButton.svelte";
  import { watchFit } from "./fit.ts";
  import { PARSE_MESSAGES } from "./messages.ts";
  import type { Track } from "../domain/types.ts";

  /**
   * Effekte einer Spur: eine kleine Box pro Effekt (Titel, darunter Regler und Zahl oder die Wertsteine, siehe `EffectBox`),
   * von links nach rechts umbrechend, darunter ein Suchfeld zum Hinzufügen. Ziehen am Titel verschiebt eine Box
   * (die Reihenfolge ist die im Code). Wertsteine verhalten sich wie Klangsteine (Tippen, Ziehen, Klammern, Zufall, Wiederholung).
   * `kind = 'noteOps'`: dieselbe Liste für die Rechenarten einer Notenspur (`add`, `div` …), direkt nach den Noten.
   * Brechen die Boxen um, erscheint daneben eine Lupe: sie verkleinert alle auf eine Zeile (`fit.ts`).
   * Standard ist hier die Originalgrösse (`session.fitEffects`), anders als bei den Steinreihen.
   */
  let { track, kind = "effects" }: { track: Track; kind?: RowKind } = $props();
  const ops = $derived(kind === "noteOps");

  let query = $state("");
  let open = $state(false);
  let active = $state(0);
  let search = $state<HTMLElement>();

  // Schliessen beim Tippen ausserhalb statt beim Blur: iOS nimmt dem Feld den Fokus vor dem Klick auf eine Option,
  // die Liste verschwände sonst, bevor der Klick ankommt.
  $effect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!search?.contains(e.target as Node)) open = false;
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  });

  const listId = $derived(`${kind}-list-${track.id}`);
  const options = $derived(
    ops ? searchNoteOps(query) : searchEffects(query, track.type),
  );
  const placeholder = $derived(
    ops ? "Mit Noten rechnen (add, div …)" : "Effekt hinzufügen …",
  );

  function pick(info: EffectInfo) {
    project.addEffect(track.id, info.name, kind);
    query = "";
    open = false;
    active = 0;
  }

  let boxes = $state<HTMLElement>();

  /** Schlüssel für `session.fitEffects`: eine Spur hat bis zu zwei Listen (Effekte, Rechenarten). */
  const fitKey = $derived(`${track.id}:${kind}`);
  /** Verkleinerung, damit alle Boxen auf eine Zeile passen (1 = passen in Originalgrösse). */
  let fit = $state(1);
  /** Die Boxen brechen in Originalgrösse um: nur dann gibt es die Lupe. */
  let overflows = $state(false);
  const original = $derived(!session.fitEffects.has(fitKey));
  const zoom = $derived(original ? 1 : fit);

  $effect(() => {
    if (!boxes) return;
    void track[kind].map((fx) => fx.id);
    return watchFit(boxes, zoom, (r) => {
      overflows = r.overflows;
      if (Math.abs(r.fit - fit) > 0.005) fit = r.fit;
    });
  });
  /** Einfügeposition beim Ziehen einer Box (vor dem Entfernen), null = kein Ziehen. */
  let hint = $state<number | null>(null);

  function onHandleKey(e: KeyboardEvent, id: string, i: number) {
    const dir = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (dir === 0) return;
    e.preventDefault();
    const to = dir < 0 ? i - 1 : i + 2;
    if (to < 0 || to > track[kind].length) return;
    project.moveEffect(track.id, id, to, kind);
    // Fokus bleibt am Griff, auch nachdem die Box umgezogen ist
    requestAnimationFrame(() =>
      boxes
        ?.querySelector<HTMLElement>(`[data-effect-id="${id}"] .name`)
        ?.focus(),
    );
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      open = true;
      active = Math.min(active + 1, options.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      active = Math.max(active - 1, 0);
    } else if (e.key === "Enter") {
      if (open && options[active]) {
        e.preventDefault();
        pick(options[active]);
      }
    } else if (e.key === "Escape") {
      if (open) open = false;
      else query = "";
    }
  }

  const messages = (effectId: string) => [
    ...new Set(
      project.parsedOf(effectId).errors.map((e) => PARSE_MESSAGES[e.code]),
    ),
  ];
</script>

<div class="effects">
  {#if track[kind].length > 0}
    <div class="fitrow">
      <div class="boxes" bind:this={boxes} style:--fx-fit={zoom === 1 ? undefined : zoom}>
        {#each track[kind] as fx, i (fx.id)}
          {@const info = valueInfo(fx.name)}
          {@const errors = messages(fx.id)}
          <div
            class="box"
            class:off={fx.tokens.length === 0 && !info?.noValue}
            class:bad={errors.length > 0}
            class:wide={session.mini.has(fx.id) ||
              (fx.tokens.length > 0 && singleValue(fx.tokens) === null)}
            class:before={hint === i}
            class:after={hint === i + 1 && i === track[kind].length - 1}
            data-effect-id={fx.id}
            animate:flip={{ duration: 150 }}
          >
            <div class="head">
              <!-- Griff: Ziehen verschiebt die Box, mit der Tastatur Pfeil links/rechts -->
              <span
                class="name"
                role="button"
                tabindex="0"
                title={info
                  ? `${info.description}${info.hint ? ` (${info.hint})` : ""}`
                  : undefined}
                aria-label={`${fx.name} verschieben (Pfeil links/rechts)`}
                onkeydown={(e) => onHandleKey(e, fx.id, i)}
                {@attach reorder(() => ({
                  item: () =>
                    boxes?.querySelector<HTMLElement>(
                      `[data-effect-id="${fx.id}"]`,
                    ) ?? null,
                  items: () => [
                    ...(boxes?.querySelectorAll<HTMLElement>(":scope > .box") ??
                      []),
                  ],
                  onHint: (index) => (hint = index),
                  onDrop: (index) =>
                    project.moveEffect(track.id, fx.id, index, kind),
                }))}>{fx.name}</span
              >
              <button
                class="remove"
                aria-label={`${fx.name} entfernen`}
                onclick={() => project.removeEffect(track.id, fx.id, kind)}
                >×</button
              >
            </div>
            <EffectBox {fx} />
            {#if errors.length > 0}
              <p class="error">{errors.join(" ")} Dieser Effekt ist aus.</p>
            {/if}
          </div>
        {/each}
      </div>
      {#if overflows}
        <FitButton {original} onclick={() => session.toggleFitEffects(fitKey)} />
      {/if}
    </div>
  {/if}

  <div class="search" bind:this={search}>
    <input
      type="text"
      role="combobox"
      {placeholder}
      aria-label={placeholder}
      aria-autocomplete="list"
      aria-expanded={open && options.length > 0}
      aria-controls={listId}
      aria-activedescendant={open && options[active]
        ? `${listId}-${active}`
        : undefined}
      spellcheck="false"
      autocomplete="off"
      autocapitalize="off"
      bind:value={query}
      oninput={() => {
        open = true;
        active = 0;
      }}
      onfocus={() => (open = true)}
      onblur={(e) => {
        // Fokus wandert zu einem anderen Element (Tab); beim Tippen in die Liste ist relatedTarget leer
        if (e.relatedTarget) open = false;
      }}
      onkeydown={onKeydown}
    />
    {#if open && options.length > 0}
      <ul
        id={listId}
        role="listbox"
        aria-label={ops ? "Rechenarten" : "Effekte"}
      >
        {#each options as info, i (info.name)}
          <!-- Tastatur bedient das Suchfeld (Pfeile, Enter), die Optionen bekommen keinen Fokus -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <li
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            class:active={i === active}
            onpointerdown={(e) => e.preventDefault()}
            onpointerenter={() => (active = i)}
            onclick={() => pick(info)}
          >
            <span class="opt-name">{info.name}</span>
            {#if info.synonyms.length > 0}<span class="syn"
                >{info.synonyms.join(", ")}</span
              >{/if}
            <span class="opt-desc">{info.description}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .effects {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
  }
  /* Boxen und daneben die Lupe */
  .fitrow {
    display: flex;
    align-items: flex-start;
    gap: 4px;
  }
  /* Effekte als kleine Boxen, von links umbrechend, oder verkleinert auf einer Zeile */
  .boxes {
    flex: 1;
    min-width: 0;
    zoom: var(--fx-fit, 1);
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 8px;
  }
  /* Beim Tippen in ein Zahlenfeld Originalgrösse (iOS zoomt sonst hinein). Schlägt den Wert im style-Attribut.
     Nicht bei Wertsteinen: deren Feld hat selbst normale Grösse (TokenStone), die Boxen sollen dabei nicht springen. */
  .boxes:has(:global(input.num:focus)) {
    --fx-fit: 1 !important;
  }
  /* Eine Box: oben der Titel (Griff zum Verschieben) und ×, darunter Regler und Zahl. Mit Wertsteinen wird sie breiter. */
  .box {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 96px;
    padding: 4px 4px 5px;
    border: 1.5px solid var(--val-edge);
    border-radius: 8px;
    background: var(--panel);
  }
  .box.wide {
    width: auto;
    min-width: 64px;
    max-width: 100%;
  }
  .box.bad {
    border-color: var(--red);
  }
  .box:global([data-dragging]) {
    z-index: 20;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
    pointer-events: none;
  }
  /* Einfügemarke beim Verschieben: ein Strich vor (oder nach der letzten) Box */
  .box.before::before,
  .box.after::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    border-radius: 2px;
    background: var(--blue);
  }
  .box.before::before {
    left: -7px;
  }
  .box.after::after {
    right: -7px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-bottom: 2px;
  }
  .name {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-weight: 600;
  }
  .box .name {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: grab;
    /* Am Titel zieht der Finger die Box, die Seite scrollt hier nicht */
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .box:global([data-dragging]) .name {
    cursor: grabbing;
  }
  .box.off .name {
    color: var(--mute);
  }
  .remove {
    padding: 0 3px;
    font-size: 14px;
    line-height: 1.1;
    border-color: transparent;
    color: var(--mute);
  }
  .error {
    max-width: 200px;
    margin: 4px 0 0;
    font-size: 11px;
    color: var(--red);
  }
  input {
    width: 100%;
    min-width: 0;
    padding: 5px 8px;
    border: 1.5px solid var(--line);
    border-radius: 6px;
    background: transparent;
    color: var(--ink);
    /* 16px verhindert das automatische Zoomen auf iOS */
    font:
      16px ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
  }
  input:focus {
    outline: none;
    border-color: var(--blue);
  }
  .search {
    position: relative;
    max-width: 420px;
  }
  .search input {
    border-style: dashed;
  }
  ul {
    position: absolute;
    z-index: 15;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    max-height: 320px;
    overflow-y: auto;
    margin: 0;
    padding: 4px;
    list-style: none;
    background: var(--panel);
    border: 1.5px solid var(--line);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  }
  li {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
  }
  li.active {
    background: color-mix(in srgb, var(--blue) 18%, transparent);
  }
  .opt-name {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-weight: 600;
  }
  .syn {
    color: var(--mute);
    font-size: 12px;
    align-self: center;
  }
  .opt-desc {
    grid-column: 1 / -1;
    color: var(--mute);
    font-size: 12px;
  }
</style>
