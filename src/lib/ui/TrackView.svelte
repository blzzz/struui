<script lang="ts">
  import { PARSE_MESSAGES } from "./messages.ts";
  import { midi } from "../state/midi.svelte.ts";
  import { project } from "../state/project.svelte.ts";
  import { session } from "../state/session.svelte.ts";
  import DotToggle from "./DotToggle.svelte";
  import EffectList from "./EffectList.svelte";
  import Lane from "./Lane.svelte";
  import LaneToggles from "./LaneToggles.svelte";
  import TrackCode from "./TrackCode.svelte";
  import TrackMenu from "./TrackMenu.svelte";
  import { splitDrag } from "../interaction/split-drag.ts";
  import { VOLUME_MAX } from "../domain/types.ts";
  import { SLICES_MAX, clampSlices } from "../domain/sampler.ts";
  import {
    SCALE_OCTAVES,
    SCALE_ROOTS,
    SCALE_TYPES,
    scaleName,
  } from "../domain/pitch.ts";
  import type { Track } from "../domain/types.ts";
  import type { Snippet } from "svelte";
  import type { Attachment } from "svelte/attachments";

  /** `grip`: Griff vor dem Namen, an dem die Arbeitsfläche die Spur verschiebt. */
  let { track, index, grip }: { track: Track; index: number; grip?: Snippet } =
    $props();

  /** Code statt Steine: die ganze Zeile der Spur samt Name und Effekten lässt sich bearbeiten. */
  let showCode = $state(false);
  /** Roher Code (`Track.code`): es gibt keine Steine, nur die Codezeile. */
  const isRaw = $derived(track.code !== null);

  // Roher Code zeigt immer die Codezeile. Wird er beim Tippen verstanden, bleibt die Code-Ansicht, damit der Fokus bleibt.
  $effect(() => {
    if (isRaw) showCode = true;
  });

  const solo = $derived(session.solo.has(track.id));
  /** Eine andere Spur ist Solo: diese schweigt, ohne stumm geschaltet zu sein. */
  const silenced = $derived(
    !solo && project.tracks.some((t) => session.solo.has(t.id)),
  );

  const parsed = $derived(project.parsedOf(track.id));
  const messages = $derived([
    ...new Set(parsed.errors.map((e) => PARSE_MESSAGES[e.code])),
  ]);
  /** Zufallsknöpfe über den Steinen sichtbar (Würfel). Sonst nur rote Punkte. */
  const showRandom = $derived(session.random.has(track.id));
  /** Drehknöpfe (Wiederholung, Modulo) unter den Steinen sichtbar. Sonst nur farbige Balken am Stein. */
  const showKnobs = $derived(!session.noKnobs.has(track.id));
  /** Drehknöpfe beim Klang der Noten: zu Beginn aus, `noKnobs` kehrt das hier um. */
  const soundKnobs = $derived(session.noKnobs.has(track.voice.id));
  /** Effekte rechts neben der Notation (senkrechter Strich) statt darunter. */
  const inlineFx = $derived(session.inlineFx.has(track.id));
  /** Gezogene Aufteilung (Anteil der Notation), null = Effekte nach Inhalt. */
  const ratio = $derived(
    inlineFx ? (session.fxSplit.get(track.id) ?? null) : null,
  );
  let split = $state<HTMLElement>();

  /** Pfeiltasten auf dem Knopf verschieben den senkrechten Strich in Schritten. */
  function onFlowKey(e: KeyboardEvent) {
    const dir = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!inlineFx || dir === 0) return;
    e.preventDefault();
    const now = ratio ?? (split ? currentRatio(split) : 0.5);
    session.setFxSplit(
      track.id,
      Math.min(Math.max(now + dir * 0.05, 0.15), 0.85),
    );
  }
  /** Anteil der Notation, wie er gerade dasteht (für den ersten Tastenschritt ohne gezogene Aufteilung). */
  function currentRatio(el: HTMLElement): number {
    const notation = el.querySelector<HTMLElement>(":scope > .notation");
    const fx = el.querySelector<HTMLElement>(":scope > .fx");
    const total = (notation?.offsetWidth ?? 0) + (fx?.offsetWidth ?? 0);
    return total > 0 ? (notation?.offsetWidth ?? 0) / total : 0.5;
  }

  /**
   * Der Effekt-Container reicht bis an den Rand der Spur-Box (`.cell` der Arbeitsfläche, nächster positionierter Vorfahre):
   * nach links, rechts und unten. Die Box kann höher sein als ihr Inhalt. Nur der Hintergrund wächst, nicht das Layout.
   */
  const reachEdge: Attachment<HTMLElement> = (el) => {
    const box = el.offsetParent as HTMLElement | null;
    if (!box) return;
    const place = () => {
      el.style.setProperty("--reach-left", `${el.offsetLeft}px`);
      el.style.setProperty(
        "--reach-right",
        `${box.clientWidth - el.offsetLeft - el.offsetWidth}px`,
      );
      el.style.setProperty(
        "--reach-bottom",
        `${box.clientHeight - el.offsetTop - el.offsetHeight}px`,
      );
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    ro.observe(box);
    return () => ro.disconnect();
  };
  /** Reiter im Effekt-Container einer Notenspur, in der Reihenfolge des Signalflusses. Zu Beginn der Klang. */
  let fxTab = $state<"noteOps" | "sound" | "effects">("sound");
  /** Effekt-Container aufgeklappt. Klick auf den aktiven Reiter (bzw. den Titel) klappt zu und wieder auf. */
  let fxOpen = $state(true);

  function chooseTab(tab: "noteOps" | "sound" | "effects") {
    if (fxTab === tab) fxOpen = !fxOpen;
    else {
      fxTab = tab;
      fxOpen = true;
    }
  }
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
  class:muted={track.muted || silenced}
  data-lane={track.id}
  data-lane-end={track.tokens.length}
>
  <header>
    <div class="left">
      {@render grip?.()}
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
      Kanalzug rechts im Kopf, als zusammenhängende Gruppe: Stummschaltung, Solo, Lautstärke (im Code .postgain)
      und ganz rechts Orbit bzw. MIDI-Kanal, der zugleich das Menü der Spur öffnet. Bei MIDI gibt es keinen Regler.
      In der Code-Ansicht steht alles im Text, nur der Menüknopf bleibt.
    -->
    <div class="strip">
      {#if isMidi && !showCode && !isRaw}
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
      {#if showCode && !isRaw}
        <!-- Zurück zu Steinen und Reglern; derselbe Wechsel steht auch im Menü -->
        <button
          class="to-ui"
          title="UI zeigen: Steine und Regler statt Code"
          onclick={() => (showCode = false)}>UI</button
        >
      {/if}
      <div class="group">
        {#if !showCode || isRaw}
          <button
            class="mute"
            class:active={track.muted}
            aria-pressed={track.muted}
            aria-label="Stumm"
            title={track.muted ? "Stumm (Code: .hush())" : "Stumm schalten"}
            onclick={() => project.toggleMute(track.id)}>M</button
          >
          <button
            class="mute solo"
            class:active={solo}
            aria-pressed={solo}
            aria-label="Solo"
            title={solo
              ? "Solo (andere Spuren im Code mit .hush())"
              : "Solo: nur diese Spur hören"}
            onclick={() => session.toggleSolo(track.id)}>S</button
          >
          <!-- Roher Code: Lautstärke steht, wenn überhaupt, im Code selbst -->
          {#if !isRaw && !isMidi}
            <input
              class="volume"
              type="range"
              min="0"
              max={VOLUME_MAX}
              step="0.05"
              value={track.volume}
              style:--pct={`${(Math.min(track.volume, VOLUME_MAX) / VOLUME_MAX) * 100}%`}
              aria-label={`Lautstärke von Spur ${index + 1}`}
              title={`Lautstärke ${Math.round(track.volume * 100)} %`}
              oninput={(e) =>
                project.setVolume(track.id, Number(e.currentTarget.value))}
              ondblclick={() => project.setVolume(track.id, 1)}
            />
          {/if}
        {/if}
        <!-- Orbit bzw. MIDI-Kanal, Art der Spur, Wechsel Code/UI und Entfernen -->
        <TrackMenu {track} {index} bind:showCode />
      </div>
    </div>
  </header>
  <div class="main">
    {#if showCode}
      <TrackCode {track} />
    {:else}
      <!-- Notation (Sample, Steine, Klang) und Effekt-Container: Effekte darunter oder rechts daneben -->
      <div
        class="split"
        class:inline={inlineFx}
        class:ratio={ratio !== null}
        style:--ratio={ratio}
        bind:this={split}
      >
        <!-- Die Schalter links vom Notationseditor (LaneToggles) gelten für Sample und Steine der Spur.
             Der Klang der Noten (sounds) und Effekte mit Steinen haben eigene (EffectBox). -->
        <div class="notation">
          {#if isSampler}
            <!-- Sampler-Spur: zuerst das Sample (s("brk"), Klangsteine aus der Palette), dann wie die Wertsteine es spielen -->
            <div
              class="voice sample"
              class:norandom={!showRandom}
              class:noknobs={!showKnobs}
            >
              <div
                class="box"
                class:off={track.sample.tokens.length === 0}
                class:bad={sampleMessages.length > 0}
              >
                <span class="box-name" title="Sample, im Code s(…)">s</span>
                <Lane laneId={track.sample.id} tokens={track.sample.tokens} />
              </div>
              {#if sampleMessages.length > 0}
                <p class="error">
                  {sampleMessages.join(" ")} Diese Spur bleibt stumm.
                </p>
              {:else if track.sample.tokens.length === 0}
                <p class="hint">
                  Ohne Sample bleibt diese Spur stumm. Zieh einen Klang aus der
                  Palette hierher.
                </p>
              {/if}
            </div>
            <div
              class="sampler"
              role="group"
              aria-label="Wie die Steine das Sample spielen"
            >
              <div class="seg">
                <button
                  aria-pressed={track.samplerMode === "slice"}
                  title="Das Sample in gleich lange Abschnitte teilen, die Steine sind Abschnittsnummern (.slice)"
                  onclick={() => project.setSamplerMode(track.id, "slice")}
                  >slice</button
                >
                <button
                  aria-pressed={track.samplerMode === "scrub"}
                  title="Die Steine sind Positionen im Sample, 0 = Anfang, 1 = Ende (.scrub)"
                  onclick={() => project.setSamplerMode(track.id, "scrub")}
                  >scrub</button
                >
              </div>
              {#if track.samplerMode === "slice"}
                <label
                  class="slices"
                  title={`Zahl der Abschnitte, 1 bis ${SLICES_MAX}`}
                >
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
                      if (e.currentTarget.value !== "" && n === clampSlices(n))
                        project.setSlices(track.id, n);
                    }}
                    onblur={(e) =>
                      (e.currentTarget.value = String(track.slices))}
                  />
                  <span>Abschnitte, Steine 0–{track.slices - 1}</span>
                </label>
              {:else}
                <span class="voice-desc">Positionen: 0 = Anfang, 1 = Ende</span>
              {/if}
            </div>
          {/if}
          {#if isNote}
            <!-- Notenspur: Notennamen (absolut, note) oder Stufen einer Tonleiter (relativ, n(…).scale(…)).
                 Umschalten rechnet die Steine um, die Melodie bleibt. -->
            <div
              class="sampler pitch"
              role="group"
              aria-label="Wie die Steine Noten angeben"
            >
              <!-- Schalter «Relativ» und Tonleiter (Grundton, Oktave des Grundtons, Art) kleben aneinander, wie der Kanalzug.
                   Die Tonleiter ist nur relativ aktiv; die Stufen bleiben, die Melodie folgt. -->
              <div
                class="scale"
                title={track.pitch === "relative"
                  ? `Tonleiter, im Code .scale("${scaleName(track.scale)}")`
                  : "Tonleiter: erst mit «Relativ» aktiv"}
              >
                <!-- Derselbe Schalter wie ribbon im Effekt, in einem Feld der Gruppe -->
                <span class="switch">
                  <DotToggle
                    pressed={track.pitch === "relative"}
                    title={track.pitch === "relative"
                      ? "Relativ: Stufen der Tonleiter (n mit scale). Aus: Notennamen (note)"
                      : "Aus: Notennamen (note). Ein: Stufen der Tonleiter, 0 = Grundton (n mit scale)"}
                    onclick={() =>
                      project.setPitch(
                        track.id,
                        track.pitch === "relative" ? "absolute" : "relative",
                      )}>Relativ</DotToggle
                  >
                </span>
                <select
                  class="chevron"
                  disabled={track.pitch !== "relative"}
                  aria-label="Grundton"
                  value={track.scale.root}
                  onchange={(e) =>
                    project.setScale(track.id, { root: e.currentTarget.value })}
                >
                  {#if !SCALE_ROOTS.includes(track.scale.root)}<option
                      value={track.scale.root}>{track.scale.root}</option
                    >{/if}
                  {#each SCALE_ROOTS as root (root)}<option value={root}
                      >{root}</option
                    >{/each}
                </select>
                <select
                  class="chevron"
                  disabled={track.pitch !== "relative"}
                  aria-label="Oktave des Grundtons"
                  value={track.scale.octave}
                  onchange={(e) =>
                    project.setScale(track.id, {
                      octave: Number(e.currentTarget.value),
                    })}
                >
                  {#if !(SCALE_OCTAVES as readonly number[]).includes(track.scale.octave)}<option
                      value={track.scale.octave}>{track.scale.octave}</option
                    >{/if}
                  {#each SCALE_OCTAVES as octave (octave)}<option value={octave}
                      >{octave}</option
                    >{/each}
                </select>
                <select
                  disabled={track.pitch !== "relative"}
                  class="chevron type"
                  aria-label="Tonleiter"
                  value={track.scale.type}
                  onchange={(e) =>
                    project.setScale(track.id, { type: e.currentTarget.value })}
                >
                  {#each SCALE_TYPES as type (type)}<option value={type}
                      >{type.replaceAll(":", " ")}</option
                    >{/each}
                </select>
              </div>
            </div>
          {/if}
          <div
            class="editor"
            class:norandom={!showRandom}
            class:noknobs={!showKnobs}
          >
            <!-- Erst mit mindestens einem Stein, vorher gibt es nichts umzuschalten -->
            {#if track.tokens.length > 0}
              <LaneToggles id={track.id} />
            {/if}
            <Lane laneId={track.id} tokens={track.tokens} value={isSampler} />
          </div>
        </div>
        <!-- Effekte im eigenen Container. Kopf: bei Notenspuren Reiter Note FX (Rechenarten an der Mini-Notation,
             note("f d".add("<0 3>"))), Sound (Klang der Noten, .s) und Audio FX, rechts der Schalter darunter/daneben. -->
        <section
          class="fx"
          class:last={messages.length === 0}
          aria-label="Effekte"
          {@attach reachEdge}
        >
          {#if inlineFx}
            <!-- Linker Rand: Ziehen teilt den Platz neu auf, Doppelklick richtet die Effekte wieder nach Inhalt -->
            <div
              class="grab"
              role="presentation"
              {@attach splitDrag(() => ({
                active: () => inlineFx,
                container: () => split ?? null,
                onRatio: (r) => session.setFxSplit(track.id, r),
              }))}
              ondblclick={() => session.setFxSplit(track.id, null)}
            ></div>
          {/if}
          <div class="fx-head">
            {#if isNote}
              <div class="tabs" role="tablist" aria-label="Effekte">
                <button
                  role="tab"
                  aria-selected={fxTab === "noteOps"}
                  aria-expanded={fxTab === "noteOps" ? fxOpen : undefined}
                  title="Rechnen mit den Noten (add, div …), wirkt vor dem Klang. Erneuter Klick: zu- oder aufklappen"
                  onclick={() => chooseTab("noteOps")}
                  >Note FX{#if track.noteOps.length > 0}<span class="count"
                      >{track.noteOps.length}</span
                    >{/if}</button
                >
                <button
                  role="tab"
                  class:bad={voiceMessages.length > 0}
                  aria-selected={fxTab === "sound"}
                  aria-expanded={fxTab === "sound" ? fxOpen : undefined}
                  title="Klang der Noten, im Code .s(…). Erneuter Klick: zu- oder aufklappen"
                  onclick={() => chooseTab("sound")}
                  >Sound{#if track.voice.tokens.length > 0}<span class="count"
                      >{track.voice.tokens.length}</span
                    >{/if}</button
                >
                <button
                  role="tab"
                  aria-selected={fxTab === "effects"}
                  aria-expanded={fxTab === "effects" ? fxOpen : undefined}
                  title="Effekte auf den Klang. Erneuter Klick: zu- oder aufklappen"
                  onclick={() => chooseTab("effects")}
                  >Audio FX{#if track.effects.length > 0}<span class="count"
                      >{track.effects.length}</span
                    >{/if}</button
                >
              </div>
            {:else}
              <button
                class="fx-title"
                aria-expanded={fxOpen}
                title={fxOpen ? "Effekte zuklappen" : "Effekte aufklappen"}
                onclick={() => (fxOpen = !fxOpen)}>FX</button
              >
            {/if}
            <button
              class="flow"
              aria-pressed={inlineFx}
              aria-label="Effekte neben der Notation"
              title={inlineFx
                ? "Effekte unter die Notation stellen (linken Rand ziehen: Platz aufteilen)"
                : "Effekte neben die Notation stellen"}
              onclick={() => session.toggleInlineFx(track.id)}
              onkeydown={onFlowKey}
            >
              <!-- Fluss von der Notation zu den Effekten: zeigt nach unten bzw. nach rechts -->
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="3" r="1.6" />
                <path d="M8 4.6v8.4M5 10l3 3 3-3" />
              </svg>
            </button>
          </div>
          {#if !fxOpen}
            <!-- Zugeklappt: nur der Kopf -->
          {:else if isNote && fxTab === "noteOps"}
            <EffectList {track} kind="noteOps" />
          {:else if isNote && fxTab === "sound"}
            <!-- Meist ein Stein, mehrere wechseln (<sine sawtooth>). Eigene Schalter wie links vom Notationseditor,
                 hier beide zu Beginn aus. -->
            <div
              class="voice"
              class:norandom={!session.random.has(track.voice.id)}
              class:noknobs={!soundKnobs}
            >
              <div class="editor">
                {#if track.voice.tokens.length > 0}
                  <LaneToggles id={track.voice.id} knobsAtStart={false} />
                {/if}
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
          {:else}
            <EffectList {track} />
            {#if withoutNote}
              <p class="hint">
                Ohne <code>.note()</code> schickt diese Spur keine Noten.
                <button class="small" onclick={addNote}>note hinzufügen</button>
              </p>
            {/if}
          {/if}
        </section>
      </div>
    {/if}
  </div>
  {#if messages.length > 0}
    <p class="error">{messages.join(" ")} Diese Spur bleibt stumm.</p>
  {/if}
</section>

<style>
  /* Die Fläche dahinter (Rechteck auf der Arbeitsfläche) zeichnet `Board` */
  .track {
    padding: 8px 10px 12px;
  }
  /* Zwei Spalten: links der Name, rechts MIDI-Ausgang und Kanalzug mit Menü */
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
  .to-ui {
    height: 28px;
    padding: 0 10px;
    font-size: 13px;
    font-weight: 600;
  }
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
  /* Kanalzug rechts im Kopf, waagrecht */
  .strip {
    display: flex;
    align-items: center;
    justify-self: end;
    gap: 6px;
    padding: 4px;
  }
  /*
   * Knöpfe und Regler kleben aneinander: gemeinsame Ränder, nur die äusseren Ecken rund.
   * Der Menüknopf liegt in `TrackMenu` (eigene Komponente), daher `:global`.
   */
  .group {
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
  /* Aktive Knöpfe (M, S) liegen über den Nachbarrändern */
  .group > :global(.active),
  .group > :global(:focus-visible) {
    position: relative;
    z-index: 1;
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
  /* Notation und Effekte: untereinander (block) oder nebeneinander (inline) */
  .split {
    display: flex;
    flex-direction: column;
  }
  .split.inline {
    flex-direction: row;
    align-items: stretch;
  }
  .notation {
    min-width: 0;
  }
  .split.inline .notation {
    flex: 1 1 0;
  }
  .split.inline .fx {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 50%;
  }
  /* Gezogene Aufteilung: beide Seiten im Verhältnis, unabhängig vom Inhalt */
  .split.inline.ratio .notation {
    flex: var(--ratio) 1 0;
  }
  .split.inline.ratio .fx {
    flex: calc(1 - var(--ratio)) 1 0;
    max-width: none;
  }
  /* Effekt-Container: dunkelblau, unter der Notation oder rechts daneben */
  .fx {
    position: relative;
    /* Hintergrund (::before) hinter dem Inhalt, aber über der Spur-Box */
    isolation: isolate;
    margin-top: 10px;
    padding: 0 8px 8px;
    /* Abstand vom Inhalt bis an den Rand des Hintergrunds, für Zeilen über die ganze Breite (Paramlocks) */
    --fx-edge-left: calc(8px + var(--reach-left, 0px));
    --fx-edge-right: calc(8px + var(--reach-right, 0px));
  }
  .split.inline .fx {
    margin: 0 0 0 10px;
    --fx-edge-left: 8px;
  }
  /* Hintergrund bis an den Rand der Spur-Box: darunter über die ganze Breite, daneben bis rechts.
     Steht noch eine Fehlermeldung darunter, endet er am Container. Ecken am Rand folgen der Box (18px). */
  .fx::before {
    content: "";
    position: absolute;
    z-index: -1;
    inset: 0 calc(-1 * var(--reach-right, 0px)) 0
      calc(-1 * var(--reach-left, 0px));
    border-radius: 0;
    background: var(--fx);
  }
  .fx.last::before {
    bottom: calc(-1 * var(--reach-bottom, 0px));
    border-radius: 0 0 18px 18px;
  }
  .split.inline .fx::before {
    left: 0;
    border-radius: 10px 0 0 10px;
  }
  .split.inline .fx.last::before {
    border-radius: 10px 0 18px 10px;
  }
  .fx > :global(.effects) {
    margin-top: 0;
  }
  /* Linker Rand des Containers daneben: Ziehen teilt den Platz zwischen Notation und Effekten */
  .grab {
    position: absolute;
    left: -10px;
    top: 0;
    bottom: 0;
    width: 14px;
    cursor: col-resize;
    /* Hier zieht der Finger, die Arbeitsfläche verschiebt sich nicht */
    touch-action: none;
  }
  .grab:hover,
  .grab:global([data-dragging]) {
    background: linear-gradient(
      to right,
      transparent 4px,
      var(--blue) 4px 6px,
      transparent 6px
    );
  }
  .fx-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 34px;
    margin: 4px 0px 8px;
  }
  .fx-title {
    padding: 4px 8px;
    border: none;
    border-radius: 6px;
    background: var(--fx-raised);
    color: var(--ink);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  /* Zugeklappt: der aktive Reiter bleibt erkennbar, aber ohne Fläche */
  .fx-title[aria-expanded="false"],
  .tabs button[aria-expanded="false"] {
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--fx-raised);
  }
  .tabs {
    display: flex;
    gap: 2px;
  }
  .tabs button {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--fx-mute);
  }
  .tabs button:hover {
    color: var(--ink);
  }
  .tabs button[aria-selected="true"] {
    background: var(--fx-raised);
    color: var(--ink);
  }
  /* Klang mit Fehler: der Reiter zeigt es auch, wenn ein anderer offen ist */
  .tabs button.bad {
    color: var(--red);
  }
  .count {
    min-width: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--fx-line);
    font-size: 10px;
    line-height: 16px;
    text-align: center;
  }
  /* Schalter darunter/daneben, rechts im Kopf */
  .flow {
    flex: none;
    width: 28px;
    height: 28px;
    padding: 0;
    display: grid;
    place-items: center;
    border: none;
    border-radius: 6px;
    color: var(--fx-mute);
  }
  .flow:hover {
    color: var(--ink);
    background: var(--fx-raised);
  }
  .flow svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 150ms;
  }
  .flow circle {
    fill: currentColor;
    stroke: none;
  }
  .split.inline .flow svg {
    transform: rotate(-90deg);
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
  .mute.active {
    background: var(--red);
    border-color: var(--red);
    color: #fff;
  }
  .solo.active {
    background: var(--on);
    border-color: var(--on);
    color: #000;
  }
  /*
   * Waagrechter Regler: links leise, rechts laut. Sieht aus wie die Knöpfe daneben (M, S, Orbit): so hoch, gleicher Rand,
   * ohne Fläche und ohne Rundung, er liegt immer zwischen S und Orbit. Der Pegel füllt ihn leise von links (`--pct`),
   * der Griff ist ein schmaler Strich.
   */
  .volume {
    width: 80px;
    max-width: 80px;
    min-width: 60px;
    flex: 0 1 120px;
    height: 28px;
    /* Teilt den Rand mit S, wie die übrigen Glieder der Gruppe */
    margin: 0 0 0 -1.5px;
    padding: 0;
    -webkit-appearance: none;
    appearance: none;
    border: 1.5px solid var(--line);
    border-radius: 0;
    background: linear-gradient(
      to right,
      color-mix(in srgb, var(--mute) 22%, transparent) var(--pct, 0%),
      transparent var(--pct, 0%)
    );
    overflow: hidden;
    cursor: ew-resize;
  }
  .volume:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  .volume::-webkit-slider-runnable-track {
    height: 100%;
    background: transparent;
  }
  .volume::-moz-range-track {
    height: 100%;
    background: transparent;
  }
  .volume::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 3px;
    height: 100%;
    border: none;
    border-radius: 0;
    background: var(--mute);
  }
  .volume::-moz-range-thumb {
    width: 3px;
    height: 100%;
    border: none;
    border-radius: 0;
    background: var(--mute);
  }
  .volume:hover::-webkit-slider-thumb {
    background: var(--ink);
  }
  .volume:hover::-moz-range-thumb {
    background: var(--ink);
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
  /* Konfigurationszeile der Notenspur: immer eine Zeile, bei wenig Platz wird die Tonleiter schmaler */
  .sampler.pitch {
    flex-wrap: nowrap;
    min-width: 0;
  }
  /*
   * Schalter «Relativ» und Tonleiter (drei Auswahlen) als eine Gruppe in derselben Zeile: gemeinsame Ränder, nur die
   * äusseren Ecken rund. Schrift und Farben wie Tempo in den Einstellungen (TopBar): ohne Fläche, gedämpft, beim Zeigen hell.
   * Ohne «Relativ» sind die Auswahlen blass und gesperrt.
   */
  .scale {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    min-width: 0;
  }
  .switch,
  .scale select {
    height: 28px;
    border: 1.5px solid var(--line);
    border-radius: 0;
    background-color: transparent;
    color: var(--mute);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
  }
  /* Feld um den Schalter (DotToggle), so hoch wie die Auswahlen */
  .switch {
    flex: none;
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    padding: 0 12px;
    border-radius: 8px 0 0 8px;
  }
  /* Pfeil aus `select.chevron` (app.css) */
  .scale select {
    flex: none;
    min-width: 0;
    margin: 0 0 0 -1.5px;
    padding: 0 22px 0 8px;
  }
  .scale select:enabled:hover {
    color: var(--ink);
  }
  /* Die Art der Tonleiter füllt die Zeile bis zum rechten Rand */
  .scale .type {
    flex: 1 1 auto;
    text-overflow: ellipsis;
    border-radius: 0 8px 8px 0;
  }
  .scale select:disabled {
    opacity: 0.4;
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
  /* Sample (s) als feste Box im Stil der Effekt-Boxen (EffectList), ohne Griff und × */
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
    margin: 2px 4px 8px;
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
