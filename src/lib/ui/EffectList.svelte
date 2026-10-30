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
  import { GROUP_LABELS, PARSE_MESSAGES } from "./messages.ts";
  import type { Track } from "../domain/types.ts";

  /**
   * Effekte einer Spur: eine kleine Box pro Effekt (Titel mittig, darunter Drehknopf oder die Wertsteine, dann der Modus, siehe `EffectBox`),
   * von links nach rechts umbrechend, darunter ein Suchfeld zum Hinzufügen. Ziehen am Titel verschiebt eine Box
   * (die Reihenfolge ist die im Code). Wertsteine verhalten sich wie Klangsteine (Tippen, Ziehen, Klammern, Zufall, Wiederholung).
   * `kind = 'noteOps'`: dieselbe Liste für die Rechenarten einer Notenspur (`add`, `div` …), direkt nach den Noten.
   * Antippen markiert eine Box (blauer Rand), Delete oder Backspace entfernt sie.
   * Die Boxen brechen um, sie werden nie verkleinert (anders als die Klangreihen).
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
    ops ? "Mit Noten rechnen (add, div …)" : "Effekt oder Befehl hinzufügen …",
  );

  function pick(info: EffectInfo) {
    project.addEffect(track.id, info.name, kind);
    query = "";
    open = false;
    active = 0;
  }

  let boxes = $state<HTMLElement>();

  /** Markierte Box dieser Liste, sonst null. */
  const selected = $derived(
    track[kind].find((fx) => fx.id === session.selectedEffect)?.id ?? null,
  );

  // Markierte Box: Delete oder Backspace entfernt sie (nicht beim Tippen in Feldern), Escape oder Antippen ausserhalb
  // jeder Effekt-Box hebt die Markierung auf.
  $effect(() => {
    const id = selected;
    if (!id) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Escape") session.selectedEffect = null;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      e.preventDefault();
      session.selectedEffect = null;
      project.removeEffect(track.id, id, kind);
    };
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.("[data-effect-id]"))
        session.selectedEffect = null;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
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
    <div class="boxes" bind:this={boxes}>
      {#each track[kind] as fx, i (fx.id)}
        {@const info = valueInfo(fx.name)}
        {@const errors = messages(fx.id)}
        <!-- Antippen oder Fokus markiert die Box; mit der Tastatur über den Titel (Griff) erreichbar -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="box"
          class:off={fx.tokens.length === 0 && !fx.rand && !fx.mod && !fx.lfo && !info?.noValue}
          class:bad={errors.length > 0}
          class:selected={selected === fx.id}
          class:wide={!fx.rand && !fx.mod && !fx.lfo &&
            (session.mini.has(fx.id) ||
              (fx.tokens.length > 0 && singleValue(fx.tokens) === null))}
          class:before={hint === i}
          class:after={hint === i + 1 && i === track[kind].length - 1}
          data-effect-id={fx.id}
          animate:flip={{ duration: 150 }}
          onpointerdown={() => (session.selectedEffect = fx.id)}
          onfocusin={() => (session.selectedEffect = fx.id)}
        >
          <EffectBox {fx}>
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
            </div>
          </EffectBox>
          {#if errors.length > 0}
            <p class="error">{errors.join(" ")} Dieser Effekt ist aus.</p>
          {/if}
        </div>
      {/each}
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
          {@const extra = [GROUP_LABELS[info.group], info.synonyms.join(", ")]
            .filter(Boolean)
            .join(" · ")}
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
            {#if extra}<span class="syn">{extra}</span>{/if}
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
  /* Effekte als kleine Boxen, von links umbrechend */
  .boxes {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 8px;
  }
  /* Eine Box: oben mittig der Titel (Griff zum Verschieben), darunter Drehknopf, Auswahl oder Wertsteine, dann der Modus; die rechte Kante blendet Zusatzfelder ein. Mit Wertsteinen wird sie breiter. */
  .box {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 96px;
    padding: 4px 4px 5px;
    /* border: 1.5px solid var(--val-edge); */
    border-radius: 8px;
    background: var(--box);
  }
  /* Mit Zusatzfeldern neben dem Knopf (rechte Kante der Box) oder Wertsteinen wird sie breiter, nie schmaler als mit Knopf */
  .box.wide,
  .box:has(:global(.fields)) {
    width: auto;
    min-width: 96px;
    max-width: 100%;
  }
  /* Markiert: Delete entfernt die Box */
  .box.selected {
    outline: 2px solid var(--blue);
    outline-offset: 1px;
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
    padding: 0 2px;
  }
  /* Titel immer in Schriftfarbe, nicht in der Farbe des Modus */
  .box .name {
    color: var(--ink);
    text-align: center;
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
