<script lang="ts">
  import { TEMPO_STEP, TEMPO_UNITS, cpsToUnit, unitToCps } from '../domain/tempo.ts';
  import type { TempoUnit } from '../domain/tempo.ts';
  import { patterns } from '../state/patterns.svelte.ts';
  import { playback } from '../state/playback.svelte.ts';
  import { project } from '../state/project.svelte.ts';
  import { session } from '../state/session.svelte.ts';
  import EdgeToggle from './EdgeToggle.svelte';
  import EffectList from './EffectList.svelte';
  import MainMenu from './MainMenu.svelte';

  /** Erlaubter Bereich in Zyklen pro Sekunde (12 bis 480 BPM). */
  const CPS_MIN = 0.05;
  const CPS_MAX = 2;

  const UNIT_LABEL: Record<TempoUnit, string> = { bpm: 'BPM', cpm: 'CPM', cps: 'CPS' };
  const UNIT_TITLE: Record<TempoUnit, string> = {
    bpm: 'Schläge pro Minute (4 Schläge pro Zyklus)',
    cpm: 'Zyklen pro Minute',
    cps: 'Zyklen pro Sekunde',
  };

  /** Position im aktuellen Zyklus (0–1), nur beim Abspielen. Gilt für alle Spuren gleich. */
  const phase = $derived(session.cycle === null ? 0 : session.cycle - Math.floor(session.cycle));

  const tempo = $derived(cpsToUnit(project.cps, project.tempoUnit));

  // Ring um den Abspielknopf: Umfang für stroke-dasharray
  const R = 20;
  const RING = 2 * Math.PI * R;

  function setTempo(input: HTMLInputElement): void {
    const value = Number(input.value);
    if (input.value !== '' && Number.isFinite(value) && value > 0) {
      project.cps = Math.min(CPS_MAX, Math.max(CPS_MIN, unitToCps(value, project.tempoUnit)));
    }
    // Ungültiges oder begrenztes zurück auf den geltenden Wert
    input.value = String(cpsToUnit(project.cps, project.tempoUnit));
  }

  /** Zeiger über der Leiste: ihr Klick klappt auch, die Kante zeigt es an. */
  let barHover = $state(false);

  /** Klick auf die Leiste öffnet oder schliesst die Einstellungen, ausser auf Bedienelemente (Play, Name, Menü). */
  function onBarClick(e: MouseEvent): void {
    if ((e.target as Element).closest('button, input, select, a, [role="menu"]')) return;
    session.config = !session.config;
  }

  /** Escape schliesst die Einstellungen. */
  $effect(() => {
    if (!session.config) return;
    const onKey = (e: KeyboardEvent) => {
      // Dialoge und Menüs schliessen mit Escape zuerst sich selbst
      if (e.key === 'Escape' && !(e.target as Element).closest?.('dialog, [role="menu"]')) session.config = false;
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  /** Play oben spielt die gewählte Szene; läuft das Arrangement, steht er auf Start. */
  const scenePlaying = $derived(session.playing && session.playMode === 'scene');
</script>

<!-- Feste Leiste oben: Abspielen, Name des Patterns, Menü. Ein Klick auf die Leiste (ausser auf Bedienelemente)
     oder auf die Kante öffnet darunter Tempo, Lautstärke und globale Effekte; die Kante rückt dann unter sie. -->
<div class="top" class:open={session.config}>
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<header
  class="bar"
  onclick={onBarClick}
  onpointerenter={() => (barHover = true)}
  onpointerleave={() => (barHover = false)}
>
  <button
    class="play"
    class:on={scenePlaying}
    aria-label={scenePlaying ? 'Stopp' : 'Szene abspielen'}
    title={scenePlaying ? 'Stopp' : 'Gewählte Szene abspielen'}
    onclick={() => playback.toggle()}
  >
    <!-- Rand zeigt den Fortschritt im Zyklus -->
    <svg class="ring" viewBox="0 0 48 48" aria-hidden="true">
      <circle class="track" cx="24" cy="24" r={R} />
      {#if scenePlaying}
        <circle class="done" cx="24" cy="24" r={R} stroke-dasharray={RING} stroke-dashoffset={RING * (1 - phase)} />
      {/if}
    </svg>
    <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
      {#if scenePlaying}
        <rect x="3" y="3" width="10" height="10" rx="1.5" />
      {:else}
        <path d="M4.5 2.5 L13.5 8 L4.5 13.5 Z" />
      {/if}
    </svg>
  </button>
  <!-- Name des aktuellen Patterns, hier umbenennen -->
  <input
    class="name"
    type="text"
    value={patterns.current?.name ?? ''}
    aria-label="Name des Patterns"
    title="Name des Patterns, tippen zum Umbenennen"
    spellcheck="false"
    autocomplete="off"
    onchange={(e) => {
      patterns.rename(e.currentTarget.value);
      e.currentTarget.value = patterns.current?.name ?? '';
    }}
    onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
  />
  {#if session.cycle !== null}
    <span class="cycle" aria-label="Aktueller Zyklus">{Math.floor(session.cycle) + 1}</span>
  {/if}
  <!-- Kurzanzeige der Einstellungen im Bereich darunter -->
  <span class="summary" aria-hidden="true">
    {tempo} {UNIT_LABEL[project.tempoUnit]} · {Math.round(session.volume * 100)} %
  </span>

  <MainMenu />

</header>

{#if session.config}
  <section id="config" class="config" aria-label="Einstellungen">
    <div class="field">
      <span class="label">Tempo</span>
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
          onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <select
          value={project.tempoUnit}
          aria-label="Einheit des Tempos"
          title={UNIT_TITLE[project.tempoUnit]}
          onchange={(e) => (project.tempoUnit = e.currentTarget.value as TempoUnit)}
        >
          {#each TEMPO_UNITS as unit (unit)}
            <option value={unit}>{UNIT_LABEL[unit]}</option>
          {/each}
        </select>
      </div>
    </div>

    <label class="field loudness" title={`Lautstärke ${Math.round(session.volume * 100)} %, Doppelklick: 100 %`}>
      <span class="label">Lautstärke</span>
      <span class="slider">
        <svg class="speaker" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 6 H5 L9 2.5 V13.5 L5 10 H2 Z" />
          {#if session.volume > 0}
            <path class="wave" d="M11 5.5 Q12.5 8 11 10.5" />
          {/if}
          {#if session.volume > 0.5}
            <path class="wave" d="M12.8 3.8 Q15.3 8 12.8 12.2" />
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
        <span class="pct">{Math.round(session.volume * 100)} %</span>
      </span>
    </label>

    <!-- Globale Effekte: wirken auf alle Spuren der Szene (im Code am Stapel: `stack(…).room(.3)`) -->
    <div class="field fx">
      <span class="label">Globale Effekte <small>auf alle Spuren, im Code am Stapel</small></span>
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
    label={session.config ? 'Einstellungen schliessen' : 'Tempo, Lautstärke und globale Effekte'}
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
  .bar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    /* Die Kante zählt zur Höhe (`--bar-h`) */
    height: calc(var(--bar-h) - var(--edge-h));
    padding: 0 max(12px, env(safe-area-inset-right, 0px)) 0 max(12px, env(safe-area-inset-left, 0px));
    cursor: pointer;
  }
  /* Runder Knopf, der Rand ist der Ring im SVG */
  .play {
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
  .play.on .ring .track {
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
  .cycle {
    font-size: 13px;
    color: var(--mute);
    font-variant-numeric: tabular-nums;
    min-width: 2ch;
  }
  .summary {
    margin-left: auto;
    font-size: 13px;
    color: var(--mute);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  /* Wie Text, erst beim Bearbeiten als Feld zu erkennen */
  .name {
    flex: 0 1 16ch;
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
    gap: 14px 28px;
    max-height: calc(100dvh - var(--bar-h) - var(--dock-h) - env(safe-area-inset-top, 0px));
    overflow-y: auto;
    padding: 12px max(16px, env(safe-area-inset-right, 0px)) 16px max(16px, env(safe-area-inset-left, 0px));
    border-top: 1px solid color-mix(in srgb, var(--line) 60%, transparent);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .label small {
    margin-left: 6px;
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
    opacity: 0.8;
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
    background: transparent;
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
  .tempo select {
    padding: 0 8px;
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
    flex: 1 1 220px;
    max-width: 340px;
  }
  .slider {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    color: var(--mute);
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
  .pct {
    font-size: 13px;
    font-weight: 600;
    min-width: 4.5ch;
    text-align: right;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .speaker {
    flex: none;
    width: 18px;
    height: 18px;
    fill: currentColor;
  }
  .speaker .wave {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
  }
  /* Effekt-Container wie bei den Spuren (dunkelblau), über die ganze Breite */
  .fx {
    flex: 1 0 100%;
  }
  /* Wie der Effekt-Container einer Spur: dunkelblau, abgerundet */
  .fx-box {
    padding: 8px;
    border-radius: 12px;
    background: var(--fx);
  }
  .fx-box > :global(.effects) {
    margin-top: 0;
  }
  @media (max-width: 520px) {
    .bar {
      gap: 8px;
    }
    .cycle {
      display: none;
    }
  }
</style>
