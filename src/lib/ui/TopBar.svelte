<script lang="ts">
  import {
    TEMPO_STEP,
    TEMPO_UNITS,
    cpsToUnit,
    unitToCps,
  } from "../domain/tempo.ts";
  import type { TempoUnit } from "../domain/tempo.ts";
  import { patterns } from "../state/patterns.svelte.ts";
  import { playback } from "../state/playback.svelte.ts";
  import { project } from "../state/project.svelte.ts";
  import { session } from "../state/session.svelte.ts";
  import EdgeToggle from "./EdgeToggle.svelte";
  import EffectList from "./EffectList.svelte";
  import MainMenu from "./MainMenu.svelte";

  /** Erlaubter Bereich in Zyklen pro Sekunde (12 bis 480 BPM). */
  const CPS_MIN = 0.05;
  const CPS_MAX = 2;

  const UNIT_LABEL: Record<TempoUnit, string> = {
    bpm: "BPM",
    cpm: "CPM",
    cps: "CPS",
  };
  const UNIT_TITLE: Record<TempoUnit, string> = {
    bpm: "Schläge pro Minute (4 Schläge pro Zyklus)",
    cpm: "Zyklen pro Minute",
    cps: "Zyklen pro Sekunde",
  };

  /** Position im aktuellen Zyklus (0–1), nur beim Abspielen. Gilt für alle Spuren gleich. */
  const phase = $derived(
    session.cycle === null ? 0 : session.cycle - Math.floor(session.cycle),
  );

  const tempo = $derived(cpsToUnit(project.cps, project.tempoUnit));

  function setTempo(input: HTMLInputElement): void {
    const value = Number(input.value);
    if (input.value !== "" && Number.isFinite(value) && value > 0) {
      project.cps = Math.min(
        CPS_MAX,
        Math.max(CPS_MIN, unitToCps(value, project.tempoUnit)),
      );
    }
    // Ungültiges oder begrenztes zurück auf den geltenden Wert
    input.value = String(cpsToUnit(project.cps, project.tempoUnit));
  }

  /** Zeiger über der Leiste: ihr Klick klappt auch, die Kante zeigt es an. */
  let barHover = $state(false);

  /** Klick auf die Leiste öffnet oder schliesst die Einstellungen, ausser auf Bedienelemente (Play, Name, Menü, Tempo, Lautstärke). */
  function onBarClick(e: MouseEvent): void {
    if (
      (e.target as Element).closest(
        'button, input, select, a, [role="menu"], .controls',
      )
    )
      return;
    session.config = !session.config;
  }

  /** Escape schliesst die Einstellungen. */
  $effect(() => {
    if (!session.config) return;
    const onKey = (e: KeyboardEvent) => {
      // Dialoge und Menüs schliessen mit Escape zuerst sich selbst
      if (
        e.key === "Escape" &&
        !(e.target as Element).closest?.('dialog, [role="menu"]')
      )
        session.config = false;
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  /** Play oben spielt die gewählte Szene; läuft das Arrangement, steht er auf Start. */
  const scenePlaying = $derived(
    session.playing && session.playMode === "scene",
  );
</script>

<!-- Tempo und Lautstärke, mit Icon statt Beschriftung. Mit genug Platz mittig in der Leiste, sonst in den Einstellungen. -->
{#snippet controls(where: "bar" | "config")}
  <div class={`controls ${where}`}>
    <div class="field" title="Tempo">
      <svg class="glyph" viewBox="0 0 16 16" aria-hidden="true">
        <!-- Metronom: Gehäuse und Pendel -->
        <path class="line" d="M5.5 2 H10.5 L13 14 H3 Z" />
        <path class="line" d="M8 11 L11.5 4" />
      </svg>
      <div class="tempo" role="group" aria-label="Tempo">
        <input
          type="number"
          inputmode="decimal"
          min={cpsToUnit(CPS_MIN, project.tempoUnit)}
          max={cpsToUnit(CPS_MAX, project.tempoUnit)}
          step={TEMPO_STEP[project.tempoUnit]}
          value={tempo}
          aria-label={`Tempo in ${UNIT_LABEL[project.tempoUnit]}`}
          title={UNIT_TITLE[project.tempoUnit]}
          onchange={(e) => setTempo(e.currentTarget)}
          onkeydown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        <select
          class="chevron"
          value={project.tempoUnit}
          aria-label="Einheit des Tempos"
          title={UNIT_TITLE[project.tempoUnit]}
          onchange={(e) =>
            (project.tempoUnit = e.currentTarget.value as TempoUnit)}
        >
          {#each TEMPO_UNITS as unit (unit)}
            <option value={unit}>{UNIT_LABEL[unit]}</option>
          {/each}
        </select>
      </div>
    </div>

    <label
      class="field loudness"
      title={`Lautstärke ${Math.round(session.volume * 100)} %, Doppelklick: 100 %`}
    >
      <svg class="glyph" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2 6 H5 L9 2.5 V13.5 L5 10 H2 Z" />
        {#if session.volume > 0}
          <path class="line" d="M11 5.5 Q12.5 8 11 10.5" />
        {/if}
        {#if session.volume > 0.5}
          <path class="line" d="M12.8 3.8 Q15.3 8 12.8 12.2" />
        {/if}
      </svg>
      <!-- Wie der Regler im Kanalzug der Spuren (TrackView): Pegel füllt von links, schmaler Griff -->
      <input
        class="level"
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={session.volume}
        style:--pct={`${session.volume * 100}%`}
        aria-label="Gesamtlautstärke"
        oninput={(e) => playback.setVolume(Number(e.currentTarget.value))}
        ondblclick={() => playback.setVolume(1)}
      />
    </label>
  </div>
{/snippet}

<!-- Feste Leiste oben: links der Name des Patterns, rechts Abspielen und Menü. Ein Klick auf die Leiste (ausser auf Bedienelemente)
     oder auf die Kante öffnet darunter Tempo, Lautstärke und globale Effekte; die Kante rückt dann unter sie. -->
<div class="top" class:open={session.config}>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <header
    class="bar"
    onclick={onBarClick}
    onpointerenter={() => (barHover = true)}
    onpointerleave={() => (barHover = false)}
  >
    <!-- Name des aktuellen Patterns, hier umbenennen -->
    <input
      class="name"
      type="text"
      value={patterns.current?.name ?? ""}
      aria-label="Name des Patterns"
      title="Name des Patterns, tippen zum Umbenennen"
      spellcheck="false"
      autocomplete="off"
      onchange={(e) => {
        patterns.rename(e.currentTarget.value);
        e.currentTarget.value = patterns.current?.name ?? "";
      }}
      onkeydown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />

    {@render controls("bar")}

    <!-- Abspielen und Menü kleben aneinander, wie der Kanalzug einer Spur -->
    <div class="group">
      <button
        class="play"
        class:on={scenePlaying}
        style:--pct={scenePlaying ? `${phase * 100}%` : "0%"}
        aria-label={scenePlaying ? "Stopp" : "Szene abspielen"}
        title={scenePlaying
          ? `Stopp (Zyklus ${Math.floor(session.cycle ?? 0) + 1})`
          : "Gewählte Szene abspielen"}
        onclick={() => playback.toggle()}
      >
        <!-- Die Fläche füllt sich von links mit dem Fortschritt im Zyklus -->
        <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
          {#if scenePlaying}
            <rect x="3" y="3" width="10" height="10" rx="1.5" />
          {:else}
            <path d="M4.5 2.5 L13.5 8 L4.5 13.5 Z" />
          {/if}
        </svg>
      </button>
      <MainMenu />
    </div>
  </header>

  {#if session.config}
    <section id="config" class="config" aria-label="Einstellungen">
      {@render controls("config")}

      <!-- Globale Effekte: wirken auf alle Spuren der Szene (im Code am Stapel: `stack(…).room(.3)`) -->
      <div class="field fx">
        <!-- <span class="label">Globale Effekte</span> -->
        <div class="fx-box">
          <EffectList track={project.global} />
        </div>
      </div>
    </section>
  {/if}

  <!-- Untere Kante, auch aufgeklappt ganz unten -->
  <EdgeToggle
    open={session.config}
    at="bottom"
    label={session.config
      ? "Einstellungen schliessen"
      : "Tempo, Lautstärke und globale Effekte"}
    controls="config"
    hot={barHover}
    onclick={() => (session.config = !session.config)}
  />
</div>

<style>
  /* Leiste, darunter aufgeklappt die Einstellungen, zuunterst die Kante: zusammen fest oben, über der Fläche */
  .top {
    position: fixed;
    inset: 0 0 auto;
    z-index: 20;
    display: flex;
    flex-direction: column;
    padding-top: env(safe-area-inset-top, 0px);
    background: var(--panel);
    /* Höhe der Kante (`EdgeToggle`) */
    --edge-h: 18px;
  }
  .top.open {
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.25);
  }
  /* Drei Spalten: Name links, Tempo und Lautstärke mittig (wenn Platz), Abspielen und Menü rechts */
  .bar {
    flex: none;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 10px;
    /* Die Kante zählt zur Höhe (`--bar-h`) */
    height: calc(var(--bar-h) - var(--edge-h));
    padding: 0 max(12px, env(safe-area-inset-right, 0px)) 0
      max(12px, env(safe-area-inset-left, 0px));
    cursor: pointer;
  }
  /*
   * Abspielen und Menü kleben aneinander: gemeinsamer Rand, nur die äusseren Ecken rund (wie `.group` in TrackView).
   * Der Menüknopf liegt in `MainMenu`, daher `:global`.
   */
  .group {
    grid-column: 3;
    justify-self: end;
    display: flex;
    align-items: center;
  }
  .group > :global(*) {
    border-radius: 0;
  }
  .group > :global(* + *) {
    margin-left: -1.5px;
  }
  .group > :global(:first-child) {
    border-top-left-radius: 8px;
    border-bottom-left-radius: 8px;
  }
  .group > :global(:last-child) {
    border-top-right-radius: 8px;
    border-bottom-right-radius: 8px;
  }
  .play {
    width: 44px;
    height: 36px;
    padding: 0;
    display: grid;
    place-items: center;
    border-color: var(--line);
    border-radius: inherit;
    color: var(--ink);
    background: linear-gradient(
      to right,
      color-mix(in srgb, var(--on) 35%, transparent) var(--pct, 0%),
      transparent var(--pct, 0%)
    );
  }
  .play.on {
    border-color: var(--on);
    position: relative;
    z-index: 1;
  }
  .icon {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
  /* Wie Text, erst beim Bearbeiten als Feld zu erkennen */
  .name {
    grid-column: 1;
    justify-self: start;
    width: 16ch;
    max-width: 100%;
    min-width: 6ch;
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    color: var(--ink);
    background: transparent;
    border: 1.5px solid transparent;
    border-radius: 8px;
    padding: 5px 6px;
    margin: 0;
    text-overflow: ellipsis;
  }
  .name:hover,
  .name:focus {
    border-color: var(--line);
    background: var(--bg);
  }

  /* Einstellungen zwischen Leiste und Kante */
  .config {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0px 20px;
    max-height: calc(
      100dvh - var(--bar-h) - var(--dock-h) - env(safe-area-inset-top, 0px)
    );
    overflow-y: auto;
    padding: 12px max(16px, env(safe-area-inset-right, 0px)) 16px
      max(16px, env(safe-area-inset-left, 0px));
  }
  /*
   * Tempo und Lautstärke: in der Leiste mittig, in den Einstellungen zentriert über den Effekten.
   * Ab 760px Breite stehen sie in der Leiste, darunter in den Einstellungen.
   */
  .controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px 28px;
    min-width: 0;
  }
  .controls.bar {
    display: none;
    grid-column: 2;
    cursor: auto;
  }
  .controls.config {
    flex: 1 0 100%;
    flex-wrap: wrap;
  }
  @media (min-width: 760px) {
    .controls.bar {
      display: flex;
    }
    .controls.config {
      display: none;
    }
  }
  .field {
    display: flex;
    flex-direction: row;
    gap: 8px;
    min-width: 0;
    align-items: center;
  }
  /* Icon statt Beschriftung */
  .glyph {
    flex: none;
    width: 18px;
    height: 18px;
    fill: var(--mute);
  }
  .glyph .line {
    fill: none;
    stroke: var(--mute);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  /* Tempo und Lautstärke gleich hoch, mit Rand wie die Knöpfe im Kanalzug der Spuren, ohne Fläche */
  .tempo {
    display: flex;
    align-items: stretch;
    flex: none;
    height: 34px;
    border: 1.5px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
  }
  .tempo:focus-within {
    border-color: var(--mute);
  }
  .tempo input,
  .tempo select {
    font: inherit;
    color: var(--ink);
    /* Nur die Farbe: `background` setzte auch den Pfeil (`select.chevron`) zurück */
    background-color: transparent;
    border: none;
    margin: 0;
    outline: none;
  }
  .tempo input {
    width: 6ch;
    padding: 0 6px 0 10px;
    font-size: 16px;
    font-weight: 600;
    text-align: right;
    font-variant-numeric: tabular-nums;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .tempo input::-webkit-inner-spin-button,
  .tempo input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  /* Pfeil aus `select.chevron` (app.css) */
  .tempo select {
    padding: 0 22px 0 8px;
    border-left: 1.5px solid var(--line);
    font-size: 12px;
    font-weight: 600;
    color: var(--mute);
    cursor: pointer;
  }
  .tempo select:hover {
    color: var(--ink);
  }
  .loudness {
    flex: 0 1 260px;
    height: 34px;
  }
  .controls.bar .loudness {
    flex-basis: 180px;
  }
  /*
   * Wie die Lautstärke einer Spur (TrackView): waagrechter Regler mit Rand und Radius, ohne Fläche. Der Pegel füllt ihn leise
   * von links (`--pct`), der Griff ist ein schmaler Strich.
   */
  .level {
    flex: 1;
    min-width: 80px;
    height: 100%;
    margin: 0;
    padding: 0;
    -webkit-appearance: none;
    appearance: none;
    border: 1.5px solid var(--line);
    border-radius: 8px;
    background: linear-gradient(
      to right,
      color-mix(in srgb, var(--mute) 22%, transparent) var(--pct, 0%),
      transparent var(--pct, 0%)
    );
    overflow: hidden;
    cursor: ew-resize;
  }
  .level:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  .level::-webkit-slider-runnable-track {
    height: 100%;
    background: transparent;
  }
  .level::-moz-range-track {
    height: 100%;
    background: transparent;
  }
  .level::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 3px;
    height: 100%;
    border: none;
    border-radius: 2px;
    background: var(--mute);
  }
  .level::-moz-range-thumb {
    width: 3px;
    height: 100%;
    border: none;
    border-radius: 2px;
    background: var(--mute);
  }
  .level:hover::-webkit-slider-thumb {
    background: var(--ink);
  }
  .level:hover::-moz-range-thumb {
    background: var(--ink);
  }
  /* Effekt-Container wie bei den Spuren (dunkelblau), über die ganze Breite */
  .fx {
    flex: 1 0 100%;
  }
  /* Wie der Effekt-Container einer Spur: dunkelblau, abgerundet */
  .fx-box {
    flex: 1 0 100%;
    padding: 8px;
    /* border-radius: 12px; */
    background: var(--fx);
  }
  .fx-box > :global(.effects) {
    margin-top: 0;
  }
  @media (max-width: 520px) {
    .bar {
      gap: 8px;
    }
  }
</style>
