<script lang="ts">
  import { project } from "../state/project.svelte.ts";
  import { session } from "../state/session.svelte.ts";
  import Lane from "./Lane.svelte";
  import LaneToggles from "./LaneToggles.svelte";
  import LockParams from "./LockParams.svelte";
  import { PARSE_MESSAGES } from "./messages.ts";
  import type { Track } from "../domain/types.ts";

  /**
   * Paramlocks (.up("…".as("…"))) am Ende der Effekte, wie im Code: was danach kommt, gewinnt. Fest am Ende, ohne Griff.
   * Werte Schritt für Schritt, je Parameter ein Teil im Stein, die Parameter als Block vorne (`LockParams`).
   * Pausen lassen den Schritt aus. Knöpfe wie beim Klang der Noten zu Beginn aus.
   * Ohne Parameter hat die Spur keine Paramlocks: dann nur ein Kopf wie «FX» und ein Plus, das den ersten Parameter wählt.
   */
  let { track }: { track: Track } = $props();

  let open = $state(true);
  const active = $derived(track.locks.params.length > 0);
  const addLabel = "Paramlocks: ersten Parameter wählen";

  const messages = $derived([
    ...new Set(
      project
        .parsedOf(track.locks.id)
        .errors.map((e) => PARSE_MESSAGES[e.code]),
    ),
  ]);
</script>

{#if !active}
  <!-- Wie der Kopf der Effekte (TrackView) und ihr Plus (EffectList) -->
  <div class="locks idle">
    <span class="title" title={`Paramlocks, im Code .up("…".as("…")) nach den Effekten`}>Paramlocks</span>
    <button
      class="add"
      aria-label={addLabel}
      title={addLabel}
      aria-haspopup="dialog"
      onclick={() =>
        (session.effectPicker = { trackId: track.id, kind: "locks", index: null })}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
    </button>
  </div>
{:else}
<div
  class="locks"
  class:norandom={!session.random.has(track.locks.id)}
  class:noknobs={!session.noKnobs.has(track.locks.id)}
>
  <div
    class="box"
    class:off={track.locks.tokens.length === 0}
    class:bad={messages.length > 0}
  >
    <button
      class="name"
      aria-expanded={open}
      title={`Paramlocks, im Code .up("…".as("…")) nach den Effekten. Klick: ${open ? "zuklappen" : "aufklappen"}`}
      onclick={() => (open = !open)}>Paramlocks</button
    >
    {#if open}
      <div class="editor">
        {#if track.locks.tokens.length > 0}
          <LaneToggles id={track.locks.id} knobsAtStart={false} />
        {/if}
        <Lane laneId={track.locks.id} tokens={track.locks.tokens} value>
          {#snippet lead()}<LockParams {track} />{/snippet}
        </Lane>
      </div>
    {/if}
  </div>
  {#if messages.length > 0}
    <p class="error">
      {messages.join(" ")} Die Paramlocks fehlen dann im Code.
    </p>
    <!-- {:else if open && track.locks.tokens.length === 0}
    <p class="hint">
      Jeder Stein setzt die Parameter im Block vorne für einen Schritt, eine
      Pause lässt ihn aus. Leer bleiben dürfen nur untere Felder.
    </p> -->
  {/if}
</div>
{/if}

<style>
  .locks {
    margin-top: 12px;
  }
  /* Noch keine Paramlocks: Titel wie «FX» (`.fx-title` in TrackView), darunter das Plus wie in EffectList */
  .idle {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .title {
    padding: 4px 8px;
    border-radius: 6px;
    background: var(--fx-raised);
    color: var(--ink);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .add {
    width: 40px;
    min-height: 96px;
    padding: 0;
    display: grid;
    place-items: center;
    border: 1.5px dashed var(--line);
    border-radius: 8px;
    color: var(--mute);
  }
  .add:hover {
    border-color: var(--ink);
    color: var(--ink);
  }
  .add svg {
    width: 18px;
    height: 18px;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
  }
  /* Wie eine Effekt-Box (EffectList), aber als Band über die ganze Breite des Effekt-Containers (Ränder aus TrackView) */
  .box {
    display: flex;
    flex-direction: column;
    margin: 12px calc(-1 * var(--fx-edge-right, 0px)) 0
      calc(-1 * var(--fx-edge-left, 0px));
    padding: 12px var(--fx-edge-right, 4px) 5px var(--fx-edge-left, 4px);
    border: 1.5px solid transparent;
    border-inline: none;
    background: var(--box);
    --lock-row: 18px;
    --lock-pad: 3px;
  }
  .box.bad {
    border-color: var(--red);
  }
  /* Titel als Schalter zum Zu- und Aufklappen, sieht aus wie der Titel einer Effekt-Box */
  .name {
    align-self: flex-start;
    margin: 0 8px 12px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--ink);
    text-align: left;
    font:
      600 12px ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
  }
  .name[aria-expanded="false"] {
    margin-bottom: 0;
  }
  .box.off .name {
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
  .hint {
    color: var(--mute);
    font-size: 13px;
    margin: 8px 0 0;
  }
  .error {
    color: var(--red);
    font-size: 13px;
    margin: 8px 0 0;
  }
</style>
