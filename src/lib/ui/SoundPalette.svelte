<script lang="ts">
  import type { Snippet } from "svelte";
  import { ALL_SOUNDS, SOUND_GROUPS } from "../domain/sounds.ts";
  import { PAUSE } from "../domain/types.ts";
  import { tokenGestures } from "../interaction/token-gestures.ts";
  import { project } from "../state/project.svelte.ts";
  import type { PaletteItem } from "../state/project.svelte.ts";
  import { recording } from "../state/recording.svelte.ts";
  import { sampleBank } from "../state/sample-bank.svelte.ts";
  import { session } from "../state/session.svelte.ts";

  /**
   * Zweizeilige Palette unter dem Klangeditor. Oben eine schmale feste Zeile: Titel, rechts Suchen, Datei laden
   * und Aufnehmen. Die Lupe verwandelt den Titel in ein Suchfeld.
   * Unten waagrecht scrollbar: Pause, eigene Klänge, dann alle Steine nach Gruppen mit Überschrift.
   * Steine von hier in eine Spur ziehen (nach oben/unten ziehen, seitwärts scrollt die Zeile) oder antippen,
   * dann kommen sie ans Ende dieser Spur.
   * Über der Mitte eines Klangsteins losgelassen, ersetzt ein Klang ihn. Klammerpaare kommen über das Menü eines Steins (Umschliessen).
   * Das Suchfeld filtert eigene und mitgelieferte Klänge, die Pause bleibt immer sichtbar.
   * Ohne Suche stehen die Klänge nach Gruppen (`SOUND_GROUPS`), mit Suche alle Klänge, die Strudel kennt
   * (auch die Drum Machines wie `AkaiLinn_bd`), die aus den Gruppen zuerst.
   *
   * `mode`: `sounds` füllt die Klangsteine der Spur. `voice` füllt den Klang einer Notenspur (`.s`): Antippen ersetzt ihn,
   * Pause gibt es dort nicht (`.s("~")` wäre still). Notensteine kommen nicht aus der Palette, sondern über das + der Reihe.
   */
  let { trackId, mode = "sounds" }: { trackId: string; mode?: "sounds" | "voice" } = $props();

  /** Die Reihe, in die Antippen ablegt: die Spur selbst oder ihr Klang. */
  const laneId = $derived(mode === "voice" ? (project.lane(trackId)?.track.voice.id ?? trackId) : trackId);

  let fileInput = $state<HTMLInputElement>();
  let query = $state("");
  /** Suchfeld statt Titel. Leer verlassen oder Escape klappt es wieder zu. */
  let searchOpen = $state(false);

  function closeSearch() {
    query = "";
    searchOpen = false;
  }
  /** Die Meldung gehört zu der Spur, in der die Aufnahme gestartet wurde. */
  let mine = $state(false);

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

  /** Ablegen nur in Reihen mit passendem Inhalt: Klänge zu Klängen, Noten zu Noten, nie in Effektreihen. */
  const fits = (target: { laneId: string } | null) =>
    target !== null && project.contentOf(target.laneId) === "sounds";

  function tap(item: PaletteItem) {
    if (mode === "voice" && item.kind === "sound") project.setVoice(trackId, item.name);
    else project.insertItem(laneId, null, item);
  }

  function gestures(item: PaletteItem) {
    return tokenGestures(() => ({
      onTap: () => tap(item),
      onDoubleTap: () => tap(item),
      immediateTap: true,
      replaces: true,
      canDrag: (dx, dy) => Math.abs(dy) > Math.abs(dx),
      onDragMove: (target) => (session.dropHint = fits(target) ? target : null),
      onDrop: (target) => {
        if (!target || !fits(target)) return;
        if (target.replace) project.replaceWithItem(target.laneId, target.index, item);
        else project.insertItem(target.laneId, target.index, item);
      },
    }));
  }

  async function record() {
    mine = true;
    await recording.toggle();
  }

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    mine = true;
    await recording.load(file);
  }
</script>

<div
  class="palette"
  role="toolbar"
  aria-label={mode === "voice" ? "Klang der Noten" : "Steine zum Hineinziehen"}
>
  <!-- Obere Zeile, fest und schmal: Titel links, Suchen, Laden und Aufnehmen als kleine Knöpfe rechts.
       Die Lupe macht aus dem Titel ein Suchfeld. -->
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
      <div class="tools">
        {#if !searchOpen}
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
        {/if}
        <button
          class="tool"
          onclick={() => fileInput?.click()}
          aria-label="Audiodatei laden"
          title="Audiodatei laden"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"
            ><path d="M8 11V3M4.5 6.5 8 3l3.5 3.5M3 13h10" /></svg
          >
        </button>
        <input
          bind:this={fileInput}
          type="file"
          accept="audio/*"
          hidden
          onchange={onFile}
        />
        <button
          class="tool rec"
          class:on={recording.active}
          onclick={record}
          aria-label={recording.active
            ? "Aufnahme beenden"
            : "Aufnehmen (bis 3 Sekunden)"}
          title={recording.active ? "Aufnahme beenden" : "Aufnehmen (bis 3 Sekunden)"}
        >
          {#if recording.active}■ {recording.seconds.toFixed(1)}{:else}●{/if}
        </button>
      </div>
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
  <div class="stones">
    {#if mode !== "voice"}
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
    {/if}
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
</div>
{#if mine && recording.message}
  <p class="message" role="alert">{recording.message}</p>
{/if}

<style>
  .palette {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 8px;
    /* Gehört nicht zur Spur: über deren Innenabstand hinaus bis an den Rand des Fensters */
    --edge-l: max(12px, env(safe-area-inset-left, 0px));
    --edge-r: max(12px, env(safe-area-inset-right, 0px));
    margin-inline: calc(-1 * var(--edge-l)) calc(-1 * var(--edge-r));
    padding: 4px 0 8px;
    background: var(--palette);
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
    margin: 4px 0 0;
  }
</style>
