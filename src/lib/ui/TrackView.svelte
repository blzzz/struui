<script lang="ts">
  import { PARSE_MESSAGES } from "./messages.ts";
  import { midi } from "../state/midi.svelte.ts";
  import { project } from "../state/project.svelte.ts";
  import { session } from "../state/session.svelte.ts";
  import EffectList from "./EffectList.svelte";
  import Lane from "./Lane.svelte";
  import TrackCode from "./TrackCode.svelte";
  import TrackMenu from "./TrackMenu.svelte";
  import { VOLUME_MAX } from "../domain/types.ts";
  import { SLICES_MAX, clampSlices } from "../domain/sampler.ts";
  import type { Track } from "../domain/types.ts";

  let { track, index }: { track: Track; index: number } = $props();

  /** Code statt Steine: die ganze Zeile der Spur samt Name und Effekten lässt sich bearbeiten. */
  let showCode = $state(false);

  const parsed = $derived(project.parsedOf(track.id));
  const messages = $derived([
    ...new Set(parsed.errors.map((e) => PARSE_MESSAGES[e.code])),
  ]);
  /** Zufallsknöpfe über den Steinen sichtbar (Würfel). Sonst nur rote Punkte. */
  const showRandom = $derived(session.random.has(track.id));
  /** Drehknöpfe (Wiederholung, Modulo) unter den Steinen sichtbar. Sonst nur farbige Balken am Stein. */
  const showKnobs = $derived(!session.noKnobs.has(track.id));
  const isMidi = $derived(track.type === "midi");
  const isNote = $derived(track.type === "note");
  const isSampler = $derived(track.type === "sampler");
  const sampleMessages = $derived([
    ...new Set(
      project
        .parsedOf(track.sample.id)
        .errors.map((e) => PARSE_MESSAGES[e.code]),
    ),
  ]);
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

<section
  class="track"
  class:muted={track.muted}
  class:norandom={!showRandom}
  class:noknobs={!showKnobs}
  data-lane={track.id}
  data-lane-end={track.tokens.length}
>
  <header>
    <div class="left">
      <!-- Der Name steht im Code als Kommentar vor der Spur (/* drums */) -->
      <label class="name" title="Name der Spur, im Code als Kommentar davor">
        <!-- <span aria-hidden="true">$</span> -->
        <input
          type="text"
          value={track.name}
          placeholder="Name"
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
          onblur={() => project.ensureName(track.id)}
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
          title={track.muted ? "Stumm (Code: .hush())" : "Stumm schalten"}
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
  <div class="main">
    {#if showCode}
      <TrackCode {track} />
    {:else}
      <!-- Links vom Notationseditor zwei Schalter für die ganze Spur, zusammen so hoch wie ein Stein und auf seiner Höhe:
           Würfel = Zufallsknöpfe über den Steinen (aus: roter Punkt am Stein, nicht änderbar),
           Drehknopf = Knöpfe für Wiederholung und Modulo darunter (aus: farbiger Balken am Stein, nicht änderbar). -->
      {#if isSampler}
        <!-- Sampler-Spur: zuerst das Sample (s("brk"), Klangsteine aus der Palette), dann wie die Wertsteine es spielen -->
        <div class="voice sample">
          <div class="box" class:off={track.sample.tokens.length === 0} class:bad={sampleMessages.length > 0}>
            <span class="box-name" title="Sample, im Code s(…)">s</span>
            <Lane laneId={track.sample.id} tokens={track.sample.tokens} />
          </div>
          {#if sampleMessages.length > 0}
            <p class="error">{sampleMessages.join(" ")} Diese Spur bleibt stumm.</p>
          {:else if track.sample.tokens.length === 0}
            <p class="hint">Ohne Sample bleibt diese Spur stumm. Zieh einen Klang aus der Palette hierher.</p>
          {/if}
        </div>
        <div class="sampler" role="group" aria-label="Wie die Steine das Sample spielen">
          <div class="seg">
            <button
              aria-pressed={track.samplerMode === "slice"}
              title="Das Sample in gleich lange Abschnitte teilen, die Steine sind Abschnittsnummern (.slice)"
              onclick={() => project.setSamplerMode(track.id, "slice")}>slice</button
            >
            <button
              aria-pressed={track.samplerMode === "scrub"}
              title="Die Steine sind Positionen im Sample, 0 = Anfang, 1 = Ende (.scrub)"
              onclick={() => project.setSamplerMode(track.id, "scrub")}>scrub</button
            >
          </div>
          {#if track.samplerMode === "slice"}
            <label class="slices" title={`Zahl der Abschnitte, 1 bis ${SLICES_MAX}`}>
              <input
                type="number"
                inputmode="numeric"
                min="1"
                max={SLICES_MAX}
                step="1"
                value={track.slices}
                aria-label="Zahl der Abschnitte"
                oninput={(e) => {
                  const n = Number(e.currentTarget.value);
                  if (e.currentTarget.value !== "" && n === clampSlices(n)) project.setSlices(track.id, n);
                }}
                onblur={(e) => (e.currentTarget.value = String(track.slices))}
              />
              <span>Abschnitte, Steine 0–{track.slices - 1}</span>
            </label>
          {:else}
            <span class="voice-desc">Positionen: 0 = Anfang, 1 = Ende</span>
          {/if}
        </div>
      {/if}
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
        <Lane laneId={track.id} tokens={track.tokens} value={isSampler} />
      </div>
      {#if isNote}
        <!-- Rechenarten auf den Noten (add, div …), im Code an der Mini-Notation: note("f d".add("<0 3>")) -->
        <EffectList {track} kind="noteOps" />
        <!-- Klang der Noten (.s), eine feste Reihe vor den Effekten. Meist ein Stein, mehrere wechseln (<sine sawtooth>). -->
        <div class="voice">
          <div class="box" class:off={track.voice.tokens.length === 0} class:bad={voiceMessages.length > 0}>
            <span class="box-name" title="Klang der Noten, im Code .s(…)">s</span>
            <Lane laneId={track.voice.id} tokens={track.voice.tokens} />
          </div>
          {#if voiceMessages.length > 0}
            <p class="error">
              {voiceMessages.join(" ")} Die Noten klingen dann als triangle.
            </p>
          {:else if track.voice.tokens.length === 0}
            <p class="hint">
              Ohne Klang spielt Strudel die Noten als triangle.
            </p>
          {/if}
        </div>
      {/if}
      <EffectList {track} />
      {#if withoutNote}
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
    padding: 8px max(8px, env(safe-area-inset-right, 0px)) 12px
      max(8px, env(safe-area-inset-left, 0px));
  }
  /* Drei Spalten: links der Name, in der Mitte der Kanalzug, rechts MIDI-Ausgang und Menü */
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
  /* Schalter links, Steine rechts daneben */
  .editor {
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }
  .editor > :global(.lane) {
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
  .voice.sample {
    margin: 0 0 10px;
  }
  /* Sampler-Spur: Art (slice/scrub) und Zahl der Abschnitte, zwischen Sample und Wertsteinen */
  .sampler {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .seg {
    display: inline-flex;
    border: 1.5px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
  }
  .seg button {
    padding: 3px 10px;
    border: none;
    border-radius: 0;
    background: transparent;
    color: var(--mute);
    font:
      600 13px ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
  }
  .seg button[aria-pressed="true"] {
    background: color-mix(in srgb, var(--blue) 18%, transparent);
    color: var(--ink);
  }
  .slices {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--mute);
    font-size: 13px;
  }
  .slices input {
    width: 4.5em;
    padding: 2px 4px;
    border: 1.5px solid var(--line);
    border-radius: 6px;
    background: var(--bg);
    color: var(--ink);
    /* 16px verhindert das automatische Zoomen auf iOS */
    font-size: 16px;
    text-align: center;
  }
  /* Sample (s) und Klang der Noten (.s) als feste Box im Stil der Effekt-Boxen (EffectList), ohne Griff und × */
  .box {
    display: flex;
    flex-direction: column;
    width: fit-content;
    min-width: 64px;
    max-width: 100%;
    padding: 4px 4px 5px;
    border: 1.5px solid var(--val-edge);
    border-radius: 8px;
    background: var(--panel);
  }
  .box.bad {
    border-color: var(--red);
  }
  .box-name {
    margin-bottom: 2px;
    font:
      600 12px ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
  }
  .box.off .box-name {
    color: var(--mute);
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
