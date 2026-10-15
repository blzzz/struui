<script lang="ts">
  import { PARSE_MESSAGES } from "./messages.ts";
  import { midi } from "../state/midi.svelte.ts";
  import { project } from "../state/project.svelte.ts";
  import { session } from "../state/session.svelte.ts";
  import EffectList from "./EffectList.svelte";
  import Lane from "./Lane.svelte";
  import SoundPalette from "./SoundPalette.svelte";
  import TrackCode from "./TrackCode.svelte";
  import TrackMenu from "./TrackMenu.svelte";
  import { VOLUME_MAX } from "../domain/types.ts";
  import type { Track } from "../domain/types.ts";

  let { track, index }: { track: Track; index: number } = $props();

  /** Code statt Steine: die ganze Zeile der Spur samt Name und Effekten lässt sich bearbeiten. */
  let showCode = $state(false);

  const parsed = $derived(project.parsedOf(track.id));
  const messages = $derived([
    ...new Set(parsed.errors.map((e) => PARSE_MESSAGES[e.code])),
  ]);
  const compact = $derived(session.compact.has(track.id));
  /** Zufallsknöpfe über den Steinen sichtbar (Würfel). Sonst nur rote Punkte. */
  const showRandom = $derived(session.random.has(track.id));
  /** Drehknöpfe (Wiederholung, Modulo) unter den Steinen sichtbar. Sonst nur farbige Balken am Stein. */
  const showKnobs = $derived(!session.noKnobs.has(track.id));
  const isMidi = $derived(track.type === "midi");
  const isNote = $derived(track.type === "note");
  const voiceMessages = $derived([
    ...new Set(
      project
        .parsedOf(track.voice.id)
        .errors.map((e) => PARSE_MESSAGES[e.code]),
    ),
  ]);
  /** Ohne `.note()` schickt Strudel keine Noten an das MIDI-Gerät, nur Controller und Programmwechsel. */
  const withoutNote = $derived(
    isMidi &&
      !track.effects.some((e) => e.name === "note" && e.tokens.length > 0),
  );
  /** Der gewählte Ausgang, auch wenn er gerade nicht angeschlossen ist. */
  const portNames = $derived.by(() => {
    const names = midi.ports?.ok ? midi.ports.names : [];
    return track.port && !names.includes(track.port)
      ? [...names, track.port]
      : names;
  });

  // Die Geräteliste erst holen, wenn eine Spur MIDI ist (der Browser fragt dann nach der Erlaubnis)
  $effect(() => {
    if (isMidi) midi.load();
  });

  function addNote() {
    const added = project.addEffect(track.id, "note");
    if (added?.empty) session.openSheet(added.id, null);
  }
</script>

<!-- Eingeklappt ist die Spur kein Ablageziel -->
<section
  class="track"
  class:muted={track.muted}
  class:compact
  class:norandom={!showRandom}
  class:noknobs={!showKnobs}
  data-lane={compact ? undefined : track.id}
  data-lane-end={compact ? undefined : track.tokens.length}
>
  <header>
    <div class="left">
      <!-- Pfeil: Steine gross (nach unten) oder kompakt (nach rechts). In der Code-Ansicht unsichtbar, der Name bleibt an seinem Platz. -->
      <button
        class="fold"
        class:hidden={showCode}
        aria-expanded={!compact}
        aria-label={compact ? "Steine gross zeigen" : "Kompaktansicht"}
        title={compact ? "Steine gross zeigen" : "Kompaktansicht"}
        tabindex={showCode ? -1 : 0}
        onclick={() => session.toggleCompact(track.id)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true"
          ><path d="M4 6l4 4 4-4" /></svg
        >
      </button>
      <!-- Der Name steht im Code nach dem $ ($drums:) -->
      <label class="name" title="Name der Spur, im Code nach dem $">
        <!-- <span aria-hidden="true">$</span> -->
        <input
          type="text"
          value={track.name}
          placeholder={`spur${index + 1}`}
          aria-label={`Name von Spur ${index + 1}`}
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          oninput={(e) => {
            project.rename(track.id, e.currentTarget.value);
            // Unerlaubte Zeichen sofort entfernen, damit Feld und Code übereinstimmen
            if (e.currentTarget.value !== track.name)
              e.currentTarget.value = track.name;
          }}
          onkeydown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </label>
    </div>
    <!--
      Kanalzug in der Mitte des Kopfs: Stummschaltung, Orbit (Klang, Noten) bzw. MIDI-Kanal und Lautstärke (im Code .postgain).
      Bei MIDI gibt es keinen Regler. In der Code-Ansicht steht alles im Text.
    -->
    <div class="strip">
      {#if !showCode}
        <button
          class="mute"
          class:active={track.muted}
          aria-pressed={track.muted}
          aria-label="Stumm"
          title={track.muted ? "Stumm (Code: _$)" : "Stumm schalten"}
          onclick={() => project.toggleMute(track.id)}>M</button
        >
        {#if isMidi}
          <button
            class="num"
            aria-label={`MIDI-Kanal ${track.channel}, tippen für den nächsten`}
            title={`MIDI-Kanal ${track.channel} (Code: .midichan), tippen: nächster`}
            onclick={() => project.cycleChannel(track.id)}
            ><small>ch</small>{track.channel}</button
          >
        {:else}
          <button
            class="num"
            class:set={track.orbit !== 1}
            aria-label={`Orbit ${track.orbit}, tippen für den nächsten`}
            title={`Orbit ${track.orbit} (Code: .orbit), Spuren im selben Orbit teilen Hall und Delay. Tippen: nächster`}
            onclick={() => project.cycleOrbit(track.id)}
            ><small>orb</small>{track.orbit}</button
          >
          <input
            class="volume"
            type="range"
            min="0"
            max={VOLUME_MAX}
            step="0.05"
            value={track.volume}
            aria-label={`Lautstärke von Spur ${index + 1}`}
            title={`Lautstärke ${Math.round(track.volume * 100)} %`}
            oninput={(e) =>
              project.setVolume(track.id, Number(e.currentTarget.value))}
            ondblclick={() => project.setVolume(track.id, 1)}
          />
        {/if}
      {/if}
      <div class="actions">
        {#if isMidi && !showCode}
          <select
            class="port"
            value={track.port}
            aria-label={`MIDI-Ausgang von Spur ${index + 1}`}
            title="MIDI-Ausgang, im Code .midi('…')"
            onchange={(e) => project.setPort(track.id, e.currentTarget.value)}
          >
            <option value="">Automatisch</option>
            {#each portNames as name (name)}
              <option value={name}
                >{name}{midi.ports?.ok && midi.ports.names.includes(name)
                  ? ""
                  : " (nicht verbunden)"}</option
              >
            {/each}
          </select>
        {/if}
        <!-- Art der Spur, Ansicht (Steine/Code) und Entfernen -->
        <TrackMenu {track} {index} bind:showCode />
      </div>
    </div>
  </header>
  <!-- Eingeklappt: alles in einem Fluss (Steine, Rechenarten, Klang, Effekte), ohne Paletten und Knöpfe, nur zum Ansehen -->
  <div class="main" class:flow={compact && !showCode}>
    {#if showCode}
      <TrackCode {track} />
    {:else}
      {#if compact}
        <Lane laneId={track.id} tokens={track.tokens} readonly />
      {:else}
        <!-- Links vom Notationseditor zwei Schalter für die ganze Spur, zusammen so hoch wie ein Stein und auf seiner Höhe:
             Würfel = Zufallsknöpfe über den Steinen (aus: roter Punkt am Stein, nicht änderbar),
             Drehknopf = Knöpfe für Wiederholung und Modulo darunter (aus: farbiger Balken am Stein, nicht änderbar). -->
        <div class="editor">
          <!-- Erst mit mindestens einem Stein, vorher gibt es nichts umzuschalten -->
          {#if track.tokens.length > 0}
            <div class="toggles">
              <button
                class="toggle dice"
                aria-pressed={showRandom}
                aria-label="Zufall bearbeiten"
                title={showRandom
                  ? "Zufallsknöpfe verbergen"
                  : "Zufallsknöpfe zeigen (?)"}
                onclick={() => session.toggleRandom(track.id)}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <rect x="2" y="2" width="12" height="12" rx="2.5" />
                  <circle cx="5.3" cy="5.3" r="1.1" />
                  <circle cx="8" cy="8" r="1.1" />
                  <circle cx="10.7" cy="10.7" r="1.1" />
                </svg>
              </button>
              <button
                class="toggle knobs"
                aria-pressed={showKnobs}
                aria-label="Wiederholung bearbeiten"
                title={showKnobs
                  ? "Drehknöpfe verbergen"
                  : "Drehknöpfe zeigen (* ! @ %)"}
                onclick={() => session.toggleKnobs(track.id)}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <circle class="ring" cx="8" cy="8" r="4.5" />
                  <path d="M8 8l2.2-2.2" />
                  <circle class="tick" cx="8" cy="1.6" r="0.9" />
                  <circle class="tick" cx="13.5" cy="10.8" r="0.9" />
                  <circle class="tick" cx="2.5" cy="10.8" r="0.9" />
                </svg>
              </button>
            </div>
          {/if}
          <Lane laneId={track.id} tokens={track.tokens} />
        </div>
      {/if}
      {#if isNote}
        <!-- Rechenarten auf den Noten (add, div …), im Code an der Mini-Notation: note("f d".add("<0 3>")) -->
        <EffectList {track} kind="noteOps" readonly={compact} />
        <!-- Klang der Noten (.s), eine feste Reihe vor den Effekten. Meist ein Stein, mehrere wechseln (<sine sawtooth>). -->
        {#if compact}
          {#if track.voice.tokens.length > 0}
            <div
              class="voice"
              class:bad={voiceMessages.length > 0}
              title="Klang der Noten"
            >
              <span class="voice-name">.s</span>
              <Lane
                laneId={track.voice.id}
                tokens={track.voice.tokens}
                readonly
              />
            </div>
          {/if}
        {:else}
          <div class="voice">
            <div class="voice-head">
              <span class="voice-name">.s</span>
              <span class="voice-desc">Klang der Noten</span>
            </div>
            <Lane laneId={track.voice.id} tokens={track.voice.tokens} />
            {#if voiceMessages.length > 0}
              <p class="error">
                {voiceMessages.join(" ")} Die Noten klingen dann als triangle.
              </p>
            {:else if track.voice.tokens.length === 0}
              <p class="hint">
                Ohne Klang spielt Strudel die Noten als triangle.
              </p>
            {/if}
            <SoundPalette trackId={track.id} mode="voice" />
          </div>
        {/if}
      {:else if !compact}
        <SoundPalette trackId={track.id} />
      {/if}
      <EffectList {track} readonly={compact} />
      {#if withoutNote && !compact}
        <p class="hint">
          Ohne <code>.note()</code> schickt diese Spur keine Noten.
          <button class="small" onclick={addNote}>note hinzufügen</button>
        </p>
      {/if}
    {/if}
  </div>
  {#if messages.length > 0}
    <p class="error">{messages.join(" ")} Diese Spur bleibt stumm.</p>
  {/if}
</section>

<style>
  /* Spuren gehen über die ganze Breite, getrennt durch eine Linie */
  .track {
    background: var(--panel);
    border-bottom: 1.5px solid var(--line);
    padding: 8px max(12px, env(safe-area-inset-right, 0px)) 12px
      max(12px, env(safe-area-inset-left, 0px));
  }
  /* Drei Spalten: links Pfeil und Name, in der Mitte der Kanalzug, rechts MIDI-Ausgang und Menü */
  header {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 6px;
    align-items: center;
    margin: 0 0 20px;
  }
  .left {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-self: end;
    /* Fest rechts, auch wenn der Kanalzug fehlt (Code-Ansicht) */
    grid-column: 3;
    grid-row: 1;
  }
  /* Schmal: Kanalzug in eine eigene Zeile unter Name und Menü */
  /* @media (max-width: 560px) {
    header {
      grid-template-columns: 1fr auto;
    }
    .actions {
      grid-column: 2;
    }
    .strip {
      grid-column: 1 / -1;
      grid-row: 2;
      justify-self: center;
    }
  } */
  /* Stumme Spur: Steine blasser, Bedienelemente bleiben gut lesbar */
  .muted :global(.row) {
    opacity: 0.45;
  }
  .name {
    display: flex;
    align-items: center;
    min-width: 0;
    font:
      600 14px ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
    color: var(--mute);
  }
  .name input {
    width: 14ch;
    min-width: 0;
    padding: 2px 4px;
    border: 1.5px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--ink);
    /* 16px verhindert das automatische Zoomen auf iOS */
    font: inherit;
    font-size: 16px;
  }
  .name input:hover {
    border-color: var(--line);
  }
  .name input:focus {
    outline: none;
    border-color: var(--blue);
    background: var(--bg);
  }
  .small {
    font-size: 13px;
    padding: 2px 8px;
    border-color: var(--line);
    color: var(--mute);
  }
  /* Kanalzug im Kopf, mittig, waagrecht */
  .strip {
    display: flex;
    align-items: center;
    gap: 6px;
    /* background: var(--line); */
    border-radius: 0 0 8px 8px;
    padding: 4px;
    /* margin-top: -12px; */
  }
  .mute {
    width: 28px;
    height: 28px;
    padding: 0;
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    border-color: var(--line);
    color: var(--mute);
  }
  .fold {
    width: 32px;
    height: 28px;
    padding: 0;
    border: none;
    color: var(--mute);
    flex: none;
  }
  .fold svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 0.15s ease-out;
  }
  /* Kompakt: Pfeil nach rechts (eingeklappt) */
  .compact .fold svg {
    transform: rotate(-90deg);
  }
  .fold.hidden {
    visibility: hidden;
  }
  /* Schalter links, Steine rechts daneben */
  .editor {
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }
  .editor > :global(.row) {
    flex: 1;
    min-width: 0;
  }
  /* Die Schaltergruppe ist so hoch wie ein Stein und steht auf Höhe der Steine der ersten Reihe
     (mit Zufallsknöpfen darüber um deren Zeile tiefer, siehe TokenColumn) */
  .toggles {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: var(--s);
    margin-top: calc(var(--s) + 2px);
  }
  .norandom .toggles {
    margin-top: 0;
  }
  /* Zurückhaltend: ohne Rand und Fläche, nur das Symbol. Aus blass, an weiss. */
  .toggle {
    flex: 1;
    width: 28px;
    min-height: 0;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--mute);
    opacity: 0.6;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .toggle:hover {
    opacity: 1;
  }
  .toggle svg {
    width: 16px;
    height: 16px;
  }
  .dice rect {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
  }
  .dice circle {
    fill: currentColor;
  }
  .knobs .ring,
  .knobs path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
  }
  .knobs .tick {
    fill: currentColor;
  }
  /* An: weiss (im hellen Farbschema wäre Weiss unsichtbar, dort die Textfarbe) */
  .toggle[aria-pressed="true"] {
    background: transparent;
    color: var(--ink);
    opacity: 1;
  }
  @media (prefers-color-scheme: dark) {
    .toggle[aria-pressed="true"] {
      color: #fff;
    }
  }
  .mute.active {
    background: var(--red);
    border-color: var(--red);
    color: #fff;
  }
  /* Waagrechter Regler: links leise, rechts laut */
  .volume {
    width: 120px;
    max-width: 120px;
    min-width: 60px;
    flex: 0 1 120px;
    margin: 0;
    accent-color: var(--mute);
  }
  /* Orbit bzw. MIDI-Kanal: Nummer mit kleiner Beschriftung, Tippen zählt weiter */
  /* Orbit bzw. MIDI-Kanal: kleine Beschriftung und Zahl auf einer Mittellinie, so hoch wie M */
  .num {
    height: 28px;
    min-width: 28px;
    padding: 0 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    border-color: var(--line);
    color: var(--mute);
    font-variant-numeric: tabular-nums;
  }
  .num small {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    opacity: 0.8;
  }
  .num.set {
    color: var(--ink);
  }
  .port {
    max-width: 16ch;
    font-size: 13px;
    padding: 2px 4px;
    border: 1.5px solid var(--line);
    border-radius: 8px;
    background: var(--bg);
    color: var(--ink);
  }
  .voice {
    margin-top: 10px;
  }
  /* Eingeklappt: Steine, Rechenarten, Klang und Effekte folgen in einer umbrechenden Zeile aufeinander */
  .main.flow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
  }
  .flow .voice {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0;
    padding-left: 6px;
  }
  .flow .voice-name {
    font-size: 13px;
  }
  .flow .voice.bad .voice-name {
    color: var(--red);
    text-decoration: line-through;
  }
  .voice-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 4px;
  }
  .voice-name {
    font:
      600 14px ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
  }
  .voice-desc {
    color: var(--mute);
    font-size: 13px;
  }
  .hint {
    color: var(--mute);
    font-size: 13px;
    margin: 8px 0 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .muted .volume {
    opacity: 0.45;
  }
  .error {
    color: var(--red);
    font-size: 13px;
    margin: 8px 0 0;
  }
</style>
