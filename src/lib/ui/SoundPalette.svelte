<script lang="ts">
  import type { Snippet } from "svelte";
  import { ALL_SOUNDS, SOUND_GROUPS } from "../domain/sounds.ts";
  import { PAUSE } from "../domain/types.ts";
  import { edgeFade } from "../interaction/edge-fade.ts";
  import { tokenGestures } from "../interaction/token-gestures.ts";
  import type { DropTarget } from "../interaction/token-gestures.ts";
  import { playback } from "../state/playback.svelte.ts";
  import { project } from "../state/project.svelte.ts";
  import type { PaletteItem } from "../state/project.svelte.ts";
  import { recording } from "../state/recording.svelte.ts";
  import { sampleBank } from "../state/sample-bank.svelte.ts";
  import { session } from "../state/session.svelte.ts";

  /**
   * Die eine Klangpalette, fest unter der oberen Leiste, immer offen.
   * Oben eine schmale Zeile: Titel, daneben ein +, rechts die Lupe. Das + öffnet ein Menü mit Aufnehmen und Datei laden,
   * während einer Aufnahme steht dort der Knopf zum Beenden. Die Lupe verwandelt den Titel in ein Suchfeld.
   * Unten waagrecht scrollbar: Pause, eigene Klänge, dann alle Steine nach Gruppen mit Überschrift.
   * Steine von hier in eine Klangreihe ziehen (nach oben/unten ziehen, seitwärts scrollt die Zeile): in eine Klangspur
   * oder in den Klang einer Notenspur (`.s`). Über der Mitte eines Klangsteins losgelassen, ersetzt ein Klang ihn.
   * Steine kommen nur durch Ziehen in eine Spur, Antippen legt nichts ab. Langes Drücken spielt den Klang an.
   * Pause gibt es im Klang einer Notenspur nicht (`.s("~")` wäre still). Notensteine kommen über das + der Reihe.
   * Klammerpaare kommen über das Menü eines Steins (Umschliessen).
   * Das Suchfeld filtert eigene und mitgelieferte Klänge, die Pause bleibt immer sichtbar.
   * Ohne Suche stehen die Klänge nach Gruppen (`SOUND_GROUPS`), mit Suche alle Klänge, die Strudel kennt
   * (auch die Drum Machines wie `AkaiLinn_bd`), die aus den Gruppen zuerst.
   */

  let fileInput = $state<HTMLInputElement>();
  /** Menü am +: Aufnehmen oder Datei laden. */
  let addOpen = $state(false);
  let addRoot = $state<HTMLElement>();
  let addTrigger = $state<HTMLButtonElement>();

  // Tippen ausserhalb oder Escape schliesst das Menü
  $effect(() => {
    if (!addOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!addRoot?.contains(e.target as Node)) addOpen = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      addOpen = false;
      addTrigger?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  });

  function startRecording() {
    addOpen = false;
    void recording.toggle();
  }
  function chooseFile() {
    addOpen = false;
    // Noch in der Geste des Tippens, sonst öffnet der Browser keinen Dateidialog
    fileInput?.click();
  }
  let query = $state("");
  /** Suchfeld statt Titel. Leer verlassen oder Escape klappt es wieder zu. */
  let searchOpen = $state(false);

  function closeSearch() {
    query = "";
    searchOpen = false;
  }
  const groups = SOUND_GROUPS.map(
    ([label, names]) => [label, names.filter((n) => n !== PAUSE)] as const,
  ).filter(([, names]) => names.length > 0);
  const grouped = new Set(groups.flatMap(([, names]) => names));
  /** Suchreihenfolge: Klänge aus den Gruppen, danach alle übrigen. */
  const searchable = [
    ...grouped,
    ...[...ALL_SOUNDS].filter((n) => !grouped.has(n)).sort(),
  ];
  /** Mehr Treffer machen die Zeile nur lang. */
  const MAX_HITS = 80;

  /** Gross-/Kleinschreibung egal, Teilstück genügt. */
  const matches = (name: string) =>
    name.toLowerCase().includes(query.trim().toLowerCase());
  const shownOwn = $derived(sampleBank.names.filter(matches));
  const searching = $derived(query.trim() !== "");
  const shownSounds = $derived(
    searching ? searchable.filter(matches).slice(0, MAX_HITS) : [],
  );

  const isPause = (item: PaletteItem) => item.kind === "sound" && item.name === PAUSE;

  /** Ablegen nur in Klangreihen (nie Noten, nie Effekte), die Pause nicht in den Klang einer Notenspur. */
  const fits = (drop: DropTarget | null, item: PaletteItem): drop is DropTarget => {
    const lane = drop && project.lane(drop.laneId);
    return !!lane && lane.content === "sounds" && !(lane.effect && isPause(item));
  };

  function gestures(item: PaletteItem) {
    return tokenGestures(() => ({
      onTap: () => {},
      onDoubleTap: () => {},
      immediateTap: true,
      onLongPress: item.kind === "sound" && !isPause(item) ? () => void playback.preview(item.name) : undefined,
      replaces: true,
      // Pause und Klang gleichzeitig ergibt nichts: die Pause ersetzt nur
      stacks: !isPause(item),
      canDrag: (dx, dy) => Math.abs(dy) > Math.abs(dx),
      onDragMove: (drop) => (session.dropHint = fits(drop, item) ? drop : null),
      onDrop: (drop) => {
        if (!fits(drop, item)) return;
        if (drop.mode === 'stack') project.stackItem(drop.laneId, drop.index, item);
        else if (drop.mode === 'replace') project.replaceWithItem(drop.laneId, drop.index, item);
        else project.insertItem(drop.laneId, drop.index, item);
      },
    }));
  }

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    await recording.load(file);
  }
</script>

<div class="palette" role="toolbar" aria-label="Klangpalette">
  <!-- Obere Zeile, fest und schmal: Titel und + links, die Lupe rechts. Die Lupe macht aus dem Titel ein Suchfeld. -->
  <div class="head">
    {#if searchOpen}
      <div class="search-box">
        <input
          class="search"
          type="search"
          placeholder="Sound suchen..."
          aria-label="Sound suchen"
          autocomplete="off"
          spellcheck="false"
          bind:value={query}
          onblur={() => {
            if (!searching) closeSearch();
          }}
          onkeydown={(e) => {
            if (e.key === "Escape") closeSearch();
          }}
          {@attach (el) => el.focus()}
        />
        <button
          class="clear"
          onpointerdown={(e) => e.preventDefault()}
          onclick={closeSearch}
          aria-label="Suche schliessen"
          title="Suche schliessen"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>
    {:else}
      <span class="title">Klangpalette</span>
    {/if}
    <div class="add" bind:this={addRoot}>
      {#if recording.active}
        <button
          class="tool rec on"
          onclick={() => recording.toggle()}
          aria-label="Aufnahme beenden"
          title="Aufnahme beenden"
        >
          ■ {recording.seconds.toFixed(1)}
        </button>
      {:else}
        <button
          bind:this={addTrigger}
          class="tool plus"
          aria-label="Eigenen Klang hinzufügen"
          title="Eigenen Klang hinzufügen"
          aria-haspopup="menu"
          aria-expanded={addOpen}
          onclick={() => (addOpen = !addOpen)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
        </button>
      {/if}
      {#if addOpen}
        <div class="menu" role="menu" aria-label="Eigenen Klang hinzufügen">
          <button role="menuitem" onclick={startRecording} {@attach (el) => el.focus()}>
            <span class="icon rec-dot" aria-hidden="true">●</span>
            Aufnehmen <small>bis 3 Sekunden</small>
          </button>
          <button role="menuitem" onclick={chooseFile}>
            <svg class="icon" viewBox="0 0 16 16" aria-hidden="true"
              ><path d="M8 11V3M4.5 6.5 8 3l3.5 3.5M3 13h10" /></svg
            >
            Datei hochladen
          </button>
        </div>
      {/if}
      <input bind:this={fileInput} type="file" accept="audio/*" hidden onchange={onFile} />
    </div>
    {#if !searchOpen}
      <div class="tools">
        <button
          class="tool"
          onclick={() => (searchOpen = true)}
          aria-label="Sound suchen"
          title="Sound suchen"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"
            ><circle cx="7" cy="7" r="4.5" /><path d="M10.3 10.3 14 14" /></svg
          >
        </button>
      </div>
    {/if}
  </div>

  {#snippet sound(name: string)}
    <div
      class="item snd"
      class:long={name.length > 8}
      style:font-size={name.length > 7
        ? "9px"
        : name.length > 4
          ? "10px"
          : null}
      role="button"
      tabindex="0"
      aria-label={`Klang ${name}`}
      {@attach gestures({ kind: "sound", name })}
    >
      {name}
    </div>
  {/snippet}

  {#snippet group(label: string, items: Snippet)}
    <div class="group" role="group" aria-label={label}>
      <span class="group-label">{label}</span>
      <div class="group-items">{@render items()}</div>
    </div>
  {/snippet}

  <!-- Untere Zeile, waagrecht scrollbar: Pause, eigene Klänge, dann alle Steine, jeweils mit Gruppentitel -->
  <div class="stones" {@attach edgeFade}>
    {#snippet pause()}
        <div
          class="item pause"
          role="button"
          tabindex="0"
          aria-label="Pause"
          {@attach gestures({ kind: "sound", name: PAUSE })}
        >
          ~
        </div>
      {/snippet}
    {@render group("Pause", pause)}
    {#if shownOwn.length > 0}
      {#snippet own()}
        {#each shownOwn as name (name)}
          <div
            class="item snd own"
            role="button"
            tabindex="0"
            aria-label={`Eigener Klang ${name}`}
            {@attach gestures({ kind: "sound", name })}
          >
            {name}
          </div>
        {/each}
      {/snippet}
      {@render group("Eigene Aufnahmen", own)}
    {/if}
    {#if searching}
      {#if shownSounds.length > 0}
        {#snippet hits()}
          {#each shownSounds as name (name)}
            {@render sound(name)}
          {/each}
        {/snippet}
        {@render group("Treffer", hits)}
      {:else}
        <span class="empty">
          {shownOwn.length === 0 ? "Kein Sound gefunden" : "Nur eigene Klänge gefunden"}
        </span>
      {/if}
    {:else}
      {#each groups as [label, names] (label)}
        {#snippet items()}
          {#each names as name (name)}
            {@render sound(name)}
          {/each}
        {/snippet}
        {@render group(label, items)}
      {/each}
    {/if}
  </div>
  {#if recording.message}
    <p class="message" role="alert">{recording.message}</p>
  {/if}
</div>

<style>
  .palette {
    display: flex;
    flex-direction: column;
    gap: 4px;
    /* Klebt beim Scrollen unter der oberen Leiste, über den Spuren */
    position: sticky;
    top: calc(var(--bar-h) + env(safe-area-inset-top, 0px));
    z-index: 10;
    --edge-l: max(12px, env(safe-area-inset-left, 0px));
    --edge-r: max(12px, env(safe-area-inset-right, 0px));
    padding: 4px 0 8px;
    background: var(--palette);
    border-bottom: 1.5px solid var(--line);
  }
  .head {
    padding: 0 var(--edge-r) 0 var(--edge-l);
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 30px;
  }
  .title {
    font-size: 11px;
    font-weight: 600;
    color: var(--mute);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
  }
  .stones {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    /* Scrollt bis an den Rand der Box, der Abstand liegt innen */
    padding: 0 var(--edge-r) 4px var(--edge-l);
    scroll-padding-inline: var(--edge-l) var(--edge-r);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
  }
  .group {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .group + .group,
  .group + .empty {
    margin-left: 12px;
  }
  .group-label {
    font-size: 11px;
    color: var(--mute);
    white-space: nowrap;
  }
  .group-items {
    display: flex;
    gap: 4px;
  }
  .item {
    flex: none;
    height: var(--s);
    min-width: var(--s);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  .item {
    /* Seitwärts scrollt der Browser, nach oben/unten zieht die Geste */
    touch-action: pan-x;
    cursor: grab;
  }
  .item:global(.dragging) {
    opacity: 0.35;
  }
  .snd {
    width: var(--s);
    background: var(--wood);
    color: var(--wood-ink);
    box-shadow: inset 0 -3px 0 var(--wood-edge);
  }
  /* Eigene Aufnahmen: Holz mit rotem Rand, damit man sie findet */
  .own {
    width: auto;
    padding: 0 6px;
    outline: 2px solid var(--red);
    outline-offset: -2px;
  }
  .pause {
    width: var(--s);
    border: 1.5px dashed var(--line);
    color: var(--mute);
    font-size: 16px;
    font-weight: 500;
  }
  .tool {
    flex: none;
    height: 24px;
    min-width: 24px;
    padding: 0 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--line);
    border-radius: 6px;
    color: var(--mute);
    background: transparent;
    font-size: 11px;
    font-weight: 700;
  }
  .tool svg {
    width: 13px;
    height: 13px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .add {
    position: relative;
    flex: none;
  }
  /* Menü am +, wie das Menü einer Spur */
  .menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    min-width: 200px;
    background: var(--panel);
    border: 1.5px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
  }
  .menu button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    padding: 7px 8px;
    font-size: 14px;
    border-color: transparent;
    background: transparent;
    color: var(--ink);
  }
  .menu button:hover {
    background: color-mix(in srgb, var(--blue) 14%, transparent);
  }
  .menu small {
    margin-left: auto;
    padding-left: 12px;
    font-size: 12px;
    color: var(--mute);
  }
  .icon {
    width: 14px;
    height: 14px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .rec-dot {
    color: var(--red);
    font-size: 12px;
  }
  .rec {
    color: var(--red);
    border-color: var(--red);
    font-variant-numeric: tabular-nums;
  }
  .rec.on {
    background: var(--red);
    color: #fff;
  }
  .search-box {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
  }
  .search {
    flex: 1 1 auto;
    min-width: 0;
    height: 30px;
    padding: 0 30px 0 8px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: transparent;
    color: inherit;
    /* unter 16px zoomt iOS beim Antippen hinein */
    font-size: 16px;
  }
  /* Eigenes X statt dem des Browsers: leert und schliesst */
  .search::-webkit-search-cancel-button {
    -webkit-appearance: none;
    appearance: none;
  }
  .clear {
    position: absolute;
    top: 0;
    right: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--mute);
  }
  .clear svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
  }
  .search::placeholder {
    color: var(--mute);
  }
  .empty {
    flex: none;
    height: var(--s);
    display: flex;
    align-items: center;
    color: var(--mute);
    font-size: 13px;
  }
  /* Lange Namen (VCSL, Drum Machines): so breit wie der Text */
  .snd.long {
    width: auto;
    padding: 0 6px;
    white-space: nowrap;
  }
  .message {
    color: var(--red);
    font-size: 13px;
    margin: 0;
    padding: 0 var(--edge-r) 0 var(--edge-l);
  }
</style>
