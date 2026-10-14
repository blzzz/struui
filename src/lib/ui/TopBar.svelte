<script lang="ts">
  import { TEMPO_STEP, TEMPO_UNITS, cpsToUnit, unitToCps } from '../domain/tempo.ts';
  import type { TempoUnit } from '../domain/tempo.ts';
  import { playback } from '../state/playback.svelte.ts';
  import { project } from '../state/project.svelte.ts';
  import { session } from '../state/session.svelte.ts';

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
</script>

<!-- Feste Leiste oben: Abspielen, Tempo, Lautstärke, Ansicht, Hilfe -->
<header class="bar">
  <button
    class="play"
    class:on={session.playing}
    aria-label={session.playing ? 'Stopp' : 'Start'}
    title={session.playing ? 'Stopp' : 'Start'}
    onclick={() => playback.toggle()}
  >
    <!-- Rand zeigt den Fortschritt im Zyklus -->
    <svg class="ring" viewBox="0 0 48 48" aria-hidden="true">
      <circle class="track" cx="24" cy="24" r={R} />
      {#if session.playing}
        <circle class="done" cx="24" cy="24" r={R} stroke-dasharray={RING} stroke-dashoffset={RING * (1 - phase)} />
      {/if}
    </svg>
    <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
      {#if session.playing}
        <rect x="3" y="3" width="10" height="10" rx="1.5" />
      {:else}
        <path d="M4.5 2.5 L13.5 8 L4.5 13.5 Z" />
      {/if}
    </svg>
  </button>
  {#if session.cycle !== null}
    <span class="cycle" aria-label="Aktueller Zyklus">{Math.floor(session.cycle) + 1}</span>
  {/if}

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

  <label class="volume" title={`Lautstärke ${Math.round(session.volume * 100)} %`}>
    <svg class="speaker" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 6 H5 L9 2.5 V13.5 L5 10 H2 Z" />
      {#if session.volume > 0}
        <path class="wave" d="M11 5.5 Q12.5 8 11 10.5" />
      {/if}
      {#if session.volume > 0.5}
        <path class="wave" d="M12.8 3.8 Q15.3 8 12.8 12.2" />
      {/if}
    </svg>
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={session.volume}
      aria-label="Gesamtlautstärke"
      oninput={(e) => playback.setVolume(Number(e.currentTarget.value))}
      ondblclick={() => playback.setVolume(1)}
    />
  </label>

  <div class="seg" role="group" aria-label="Ansicht">
    <button aria-pressed={session.view === 'ui'} onclick={() => (session.view = 'ui')}>UI</button>
    <button aria-pressed={session.view === 'code'} onclick={() => (session.view = 'code')}>Code</button>
  </div>

  <button class="help" aria-label="Erklärung" title="Erklärung" onclick={() => (session.help = true)}>?</button>
</header>

<style>
  .bar {
    position: fixed;
    inset: 0 0 auto;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 10px;
    height: calc(var(--bar-h) + env(safe-area-inset-top, 0px));
    padding: env(safe-area-inset-top, 0px) max(12px, env(safe-area-inset-right, 0px)) 0
      max(12px, env(safe-area-inset-left, 0px));
    background: var(--panel);
    border-bottom: 1.5px solid var(--line);
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
  .tempo {
    display: flex;
    align-items: stretch;
    flex: none;
  }
  .tempo input,
  .tempo select {
    font: inherit;
    font-size: 15px;
    color: var(--ink);
    background: var(--bg);
    border: 1.5px solid var(--line);
    margin: 0;
  }
  .tempo input {
    width: 7ch;
    padding: 5px 6px;
    border-radius: 8px 0 0 8px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .tempo select {
    padding: 5px 4px;
    border-left: none;
    border-radius: 0 8px 8px 0;
    font-size: 13px;
    color: var(--mute);
  }
  .volume {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--mute);
  }
  .volume input {
    flex: 1;
    min-width: 50px;
    max-width: 160px;
    margin: 0;
    accent-color: var(--ink);
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
  .seg {
    display: flex;
  }
  .seg button {
    padding: 6px 12px;
    font-size: 14px;
  }
  .seg button:first-child {
    border-radius: 8px 0 0 8px;
  }
  .seg button:last-child {
    border-radius: 0 8px 8px 0;
    border-left: none;
  }
  .help {
    flex: none;
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: 50%;
    font-weight: 600;
  }
  @media (max-width: 520px) {
    .bar {
      gap: 8px;
    }
    .cycle,
    .speaker {
      display: none;
    }
    .tempo input {
      width: 5.5ch;
    }
    .seg button {
      padding-inline: 8px;
    }
  }
</style>
