<script lang="ts">
  import { tick } from 'svelte';
  import { edgeFade } from '../interaction/edge-fade.ts';
  import { tokenGestures } from '../interaction/token-gestures.ts';
  import { ARRANGEMENT_LANE, arrangement } from '../state/arrangement.svelte.ts';
  import { playback } from '../state/playback.svelte.ts';
  import { scenes } from '../state/scenes.svelte.ts';
  import { session } from '../state/session.svelte.ts';
  import ArrangementRow from './ArrangementRow.svelte';

  let row = $state<HTMLElement>();

  /** Kopie der aktuellen Szene anlegen, hinscrollen und den Namen gleich zum Überschreiben markieren. */
  async function duplicate() {
    const id = scenes.duplicate();
    await tick();
    const input = row?.querySelector<HTMLInputElement>(`[data-scene="${id}"] input`);
    input?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    input?.focus();
    input?.select();
  }

  /** Was nach der Nachfrage geschieht: Szene wählen oder neue anlegen. */
  type Action = { kind: 'select'; id: string } | { kind: 'duplicate' };

  /** Wartet auf die Antwort zu nicht übernommenen Änderungen (nur ohne Auto-Update). */
  let pending = $state<Action | null>(null);
  let dialog = $state<HTMLDialogElement>();

  /** Auswahl Manuell/Auto am geteilten Knopf offen. */
  let modeMenu = $state(false);

  /** Schliesst die Auswahl bei einem Tipp ausserhalb oder mit Escape. */
  function closeOutside(node: HTMLElement) {
    const down = (e: PointerEvent) => {
      if (!node.contains(e.target as Node)) modeMenu = false;
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') modeMenu = false;
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key);
    };
  }

  $effect(() => {
    if (!dialog) return;
    if (pending && !dialog.open) dialog.showModal();
    else if (!pending && dialog.open) dialog.close();
  });

  function run(a: Action) {
    if (a.kind === 'select') scenes.select(a.id);
    else void duplicate();
  }

  /** Gibt es nicht übernommene Änderungen, erst nachfragen. */
  function ask(a: Action) {
    if (!scenes.autoUpdate && scenes.dirty) pending = a;
    else run(a);
  }

  /** keep: Änderungen zuerst in die gewählte Szene schreiben. null: abbrechen. */
  function answer(keep: boolean | null) {
    const a = pending;
    pending = null;
    if (!a || keep === null) return;
    if (keep) scenes.update();
    run(a);
  }

  /** Szene antippen wählt sie, im Arrangement lässt sie sich nach unten in dessen Zeile ziehen. */
  function sceneGestures(id: string) {
    return tokenGestures(() => ({
      onTap: () => ask({ kind: 'select', id }),
      onDoubleTap: () => ask({ kind: 'select', id }),
      immediateTap: true,
      drags: () => arrangement.active,
      canDrag: (dx, dy) => Math.abs(dy) > Math.abs(dx),
      onDragMove: (t) => (arrangement.hint = t?.laneId === ARRANGEMENT_LANE ? t.index : null),
      onDrop: (t) => {
        if (t?.laneId === ARRANGEMENT_LANE) arrangement.add(id, t.index);
      },
    }));
  }

  const arrPlaying = $derived(session.playing && session.playMode === 'arrangement');
  // Ring um ▶ wie beim Play oben (`TopBar.svelte`)
  const R = 20;
  const RING = 2 * Math.PI * R;

  /** Zeilenhöhen der Leiste: Szenen (64 px Stein und Platz für die Umrandung), Schalter, Arrangement. */
  const SCENES_H = 72;
  const SYNC_H = 32;
  const ARR_H = 84;
  /** Rand oben und unten und Abstand zwischen den Zeilen. */
  const GAP = 8;

  // Mit Arrangement ist die Leiste eine Zeile höher; der Inhalt der Seite rückt mit (`--dock-h`)
  $effect(() => {
    const h = GAP + SCENES_H + GAP + SYNC_H + GAP + (arrangement.active ? ARR_H + GAP : 0);
    document.documentElement.style.setProperty('--dock-h', `${h}px`);
  });

  const playing = (tracks: { tokens: unknown[]; muted: boolean }[]) =>
    tracks.filter((t) => t.tokens.length > 0 && !t.muted).length;
</script>

<!-- Feste Leiste unten: Szenen des ganzen Projekts -->
<footer
  class="dock"
  class:arranging={arrangement.active}
  style:--scenes-h="{SCENES_H}px"
  style:--sync-h="{SYNC_H}px"
  style:--arr-h="{ARR_H}px"
>
  <button class="take" title="Aktuelle Szene als neue Szene kopieren" onclick={() => ask({ kind: 'duplicate' })}>
    <span class="plus" aria-hidden="true">+</span>
    Szene
  </button>

  <div class="row" bind:this={row} {@attach edgeFade} role="list" aria-label="Szenen">
    {#each scenes.list as s (s.id)}
      {@const n = playing(s.tracks)}
      {@const on = scenes.current.id === s.id}
      <div class="scene" class:on data-scene={s.id} role="listitem" {@attach sceneGestures(s.id)}>
        <input
          class="name"
          value={s.name}
          aria-label="Name der Szene"
          enterkeyhint="done"
          onchange={(e) => scenes.rename(s.id, e.currentTarget.value)}
          onblur={(e) => (e.currentTarget.value = s.name)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              if (e.key === 'Escape') e.currentTarget.value = s.name;
              e.currentTarget.blur();
            }
          }}
        />
        <div
          class="face"
          role="button"
          tabindex="0"
          title={arrangement.active ? 'Antippen wählt die Szene, nach unten ziehen legt sie ins Arrangement' : 'Diese Szene wählen'}
          aria-current={on}
        >
          {n} {n === 1 ? 'Spur' : 'Spuren'} · {(1 / s.cps).toFixed(1)} s{#if on && scenes.dirty}<span class="dirty"> · geändert</span>{/if}
        </div>
        {#if scenes.list.length > 1}
          <button class="x" aria-label={`${s.name} entfernen`} title="Entfernen" onclick={() => arrangement.removeScene(s.id)}>
            ×
          </button>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Untere Zeile: links Arrangement an/aus, rechts ein geteilter Knopf (Aktion, dazu die Wahl Manuell/Auto) -->
  <div class="sync" {@attach closeOutside}>
    <button
      class="toggle"
      aria-pressed={arrangement.active}
      title="Alle Szenen als Variablen in den Code, gespielt mit arrange()"
      onclick={() => {
        arrangement.active = !arrangement.active;
        if (!arrangement.active) playback.leaveArrangement();
      }}
    >
      {#if arrangement.active}<span aria-hidden="true">✓</span>{/if}
      Arrangement
    </button>
    <div class="split">
      {#if scenes.autoUpdate}
        <button class="main" title="Änderungen landen sofort in der gewählten Szene" onclick={() => (modeMenu = !modeMenu)}>
          Auto-Update
        </button>
      {:else}
        <button
          class="main"
          disabled={!scenes.dirty}
          title={scenes.dirty ? `Änderungen in ${scenes.current.name} übernehmen` : 'Keine Änderungen'}
          onclick={() => scenes.update()}
        >
          Übernehmen
        </button>
      {/if}
      <button
        class="arrow"
        aria-label="Art des Übernehmens"
        aria-haspopup="menu"
        aria-expanded={modeMenu}
        onclick={() => (modeMenu = !modeMenu)}
      >
        ▾
      </button>
    </div>
    {#if modeMenu}
      <div class="menu" role="menu" aria-label="Art des Übernehmens">
        {#each [{ auto: false, label: 'Manuell', hint: 'mit «Übernehmen»' }, { auto: true, label: 'Auto', hint: 'sofort' }] as o (o.label)}
          <button
            role="menuitemradio"
            aria-checked={scenes.autoUpdate === o.auto}
            onclick={() => {
              scenes.autoUpdate = o.auto;
              modeMenu = false;
            }}
          >
            <span class="check" aria-hidden="true">{scenes.autoUpdate === o.auto ? '✓' : ''}</span>
            {o.label} <span class="hint">{o.hint}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Ganz unten: das Arrangement, nur wenn eingeschaltet -->
  {#if arrangement.active}
    <div class="arrangement">
      <!-- Spielt das Arrangement von vorn; der Ring zeigt den Fortschritt im ganzen Durchlauf -->
      <button
        class="aplay"
        class:on={arrPlaying}
        aria-label={arrPlaying ? 'Arrangement stoppen' : 'Arrangement von vorn abspielen'}
        title={arrPlaying ? 'Stopp' : 'Arrangement von vorn abspielen'}
        disabled={!arrPlaying && arrangement.sections.length === 0}
        onclick={() => playback.toggleArrangement()}
      >
        <svg class="ring" viewBox="0 0 48 48" aria-hidden="true">
          <circle class="track" cx="24" cy="24" r={R} />
          {#if arrangement.position}
            <circle class="done" cx="24" cy="24" r={R} stroke-dasharray={RING} stroke-dashoffset={RING * (1 - arrangement.position.progress)} />
          {/if}
        </svg>
        <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
          {#if arrPlaying}
            <rect x="3" y="3" width="10" height="10" rx="1.5" />
          {:else}
            <path d="M4.5 2.5 L13.5 8 L4.5 13.5 Z" />
          {/if}
        </svg>
      </button>
      <ArrangementRow onSelect={(id) => ask({ kind: 'select', id })} />
    </div>
  {/if}
</footer>

<dialog
  bind:this={dialog}
  aria-labelledby="unsaved-title"
  onclose={() => answer(null)}
  onclick={(e) => {
    if (e.target === dialog) answer(null);
  }}
>
  <div class="box">
    <h2 id="unsaved-title">Änderungen übernehmen?</h2>
    <p>
      «{scenes.current.name}» hat Änderungen, die noch nicht übernommen sind.
      {#if pending?.kind === 'duplicate'}
        Die neue Szene bekommt sie auf jeden Fall.
      {:else}
        Ohne Übernehmen gehen sie verloren.
      {/if}
    </p>
    <div class="answers">
      <button class="primary" onclick={() => answer(true)}>In «{scenes.current.name}» übernehmen</button>
      <button onclick={() => answer(false)}>Nicht übernehmen</button>
      <button onclick={() => answer(null)}>Abbrechen</button>
    </div>
  </div>
</dialog>

<style>
  dialog {
    width: min(420px, calc(100% - 32px));
    padding: 0;
    border: none;
    border-radius: 14px;
    background: var(--panel);
    color: var(--ink);
  }
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.45);
  }
  .box {
    padding: 18px 18px 16px;
  }
  h2 {
    font-size: 18px;
    margin: 0 0 6px;
  }
  .box p {
    margin: 0 0 16px;
    font-size: 14px;
    color: var(--mute);
  }
  .answers {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .dock {
    position: fixed;
    inset: auto 0 0;
    z-index: 20;
    /*
     * Oben «+ Szene» und die Szenen, darunter Arrangement-Schalter und Übernehmen, ganz unten das Arrangement.
     * Abstände im 8er-Raster; die Höhe ergibt `--dock-h` (Summe der Zeilen, Abstände und Ränder).
     */
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: var(--scenes-h) var(--sync-h);
    align-items: center;
    gap: 8px 10px;
    height: calc(var(--dock-h) + env(safe-area-inset-bottom, 0px));
    padding: 8px max(12px, env(safe-area-inset-right, 0px)) calc(8px + env(safe-area-inset-bottom, 0px))
      max(12px, env(safe-area-inset-left, 0px));
    background: var(--panel);
    border-top: 1.5px solid var(--line);
  }
  .take {
    flex: none;
    height: 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 0 12px;
    border-style: dashed;
    font-size: 13px;
  }
  .plus {
    font-size: 22px;
    line-height: 1;
  }
  .dock.arranging {
    grid-template-rows: var(--scenes-h) var(--sync-h) var(--arr-h);
  }
  .arrangement {
    grid-column: 1 / -1;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .arrangement > :global(.arr) {
    flex: 1;
  }
  /* ▶ wie der Play-Knopf oben, mittig zu den Abschnitten (Stein und Knopf) */
  .aplay {
    position: relative;
    flex: none;
    width: 44px;
    height: 44px;
    padding: 0;
    border: none;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: var(--ink);
  }
  .aplay:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .ring {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
    fill: none;
    stroke-width: 3;
  }
  .ring .track {
    stroke: var(--ink);
  }
  .aplay.on .ring .track {
    stroke: var(--line);
  }
  .ring .done {
    stroke: var(--on);
  }
  .icon {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
  .row {
    min-width: 0;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    /* Platz für Umrandung und Schatten */
    padding: 0 4px;
  }
  /* Grösserer Stein: Holz wie ein Klangstein, oben der Name, darunter die Fläche zum Wählen */
  .scene {
    touch-action: pan-x;
    flex: none;
    position: relative;
    width: 132px;
    height: 64px;
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    background: var(--wood);
    color: var(--wood-ink);
    box-shadow: inset 0 -4px 0 var(--wood-edge);
  }
  .scene.on {
    outline: 3px solid var(--on);
    outline-offset: 1px;
  }
  .name {
    width: 100%;
    min-width: 0;
    padding: 8px 24px 2px 10px;
    border: none;
    background: transparent;
    color: inherit;
    font: 700 14px system-ui, -apple-system, 'Segoe UI', sans-serif;
    border-radius: 10px 10px 0 0;
    text-overflow: ellipsis;
  }
  .name:focus {
    outline: none;
    background: color-mix(in srgb, #fff 45%, transparent);
  }
  .face {
    flex: 1;
    display: flex;
    align-items: center;
    width: 100%;
    padding: 0 10px 6px;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    border: none;
    border-radius: 0 0 10px 10px;
    background: transparent;
    color: inherit;
    font-size: 12px;
    font-weight: 500;
    text-align: left;
    opacity: 0.8;
  }
  .x {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: inherit;
    font-size: 16px;
    line-height: 1;
    opacity: 0.6;
  }
  .x:hover {
    opacity: 1;
  }
  .dirty {
    font-style: italic;
  }
  .sync {
    position: relative;
    grid-column: 1 / -1;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  /* Umschaltknopf: gedrückt dunkel gefüllt mit Häkchen (globaler Stil für aria-pressed) */
  .toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 10px;
    font-size: 13px;
    white-space: nowrap;
  }
  .split {
    display: flex;
  }
  .split button {
    height: 30px;
    font-size: 13px;
    padding: 0 10px;
  }
  .main {
    border-radius: 8px 0 0 8px;
  }
  .main:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .arrow {
    border-left: none;
    border-radius: 0 8px 8px 0;
  }
  /* Klappt nach oben auf, die Leiste liegt am unteren Rand */
  .menu {
    position: absolute;
    right: 0;
    bottom: calc(100% + 4px);
    z-index: 1;
    display: flex;
    flex-direction: column;
    min-width: 190px;
    padding: 4px;
    border: 1.5px solid var(--line);
    border-radius: 10px;
    background: var(--panel);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
  }
  .menu button {
    display: flex;
    align-items: baseline;
    gap: 6px;
    border: none;
    padding: 8px 10px;
    font-size: 14px;
    text-align: left;
  }
  .check {
    width: 1em;
  }
  .hint {
    font-size: 12px;
    color: var(--mute);
  }
</style>
