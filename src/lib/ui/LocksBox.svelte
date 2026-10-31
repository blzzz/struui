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
   */
  let { track }: { track: Track } = $props();

  let open = $state(true);

  const messages = $derived([
    ...new Set(
      project
        .parsedOf(track.locks.id)
        .errors.map((e) => PARSE_MESSAGES[e.code]),
    ),
  ]);
</script>

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
  {:else if open && track.locks.tokens.length === 0}
    <p class="hint">
      Jeder Stein setzt die Parameter im Block vorne für einen Schritt, eine
      Pause lässt ihn aus. Leer bleiben dürfen nur untere Felder.
    </p>
  {/if}
</div>

<style>
  .locks {
    margin-top: 12px;
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
