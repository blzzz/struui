<script lang="ts">
  import { flip } from "svelte/animate";
  import { singleValue, valueInfo } from "../domain/effects.ts";
  import { project } from "../state/project.svelte.ts";
  import type { RowKind } from "../state/project.svelte.ts";
  import { session } from "../state/session.svelte.ts";
  import { reorder } from "../interaction/reorder.ts";
  import EffectBox from "./EffectBox.svelte";
  import LocksBox from "./LocksBox.svelte";
  import { PARSE_MESSAGES } from "./messages.ts";
  import type { Track } from "../domain/types.ts";

  /**
   * Effekte einer Spur: eine kleine Box pro Effekt (Titel mittig, darunter Drehknopf oder die Wertsteine, dann der Modus, siehe `EffectBox`),
   * von links nach rechts umbrechend, am Ende ein Plus zum Hinzufügen (öffnet `EffectPicker`). Ziehen am Titel verschiebt eine Box
   * (die Reihenfolge ist die im Code). Wertsteine verhalten sich wie Klangsteine (Tippen, Ziehen, Klammern, Zufall, Wiederholung).
   * `kind = 'noteOps'`: dieselbe Liste für die Rechenarten einer Notenspur (`add`, `div` …), direkt nach den Noten.
   * Der Modus-Reiter unten öffnet die Auswahl der Modi und darüber einen Knopf zum Entfernen.
   * Die Boxen brechen um, sie werden nie verkleinert (anders als die Klangreihen).
   * Paramlocks einer Klangspur stehen fest darunter, wie im Code nach den Effekten (neue Effekte kommen davor).
   */
  let { track, kind = "effects" }: { track: Track; kind?: RowKind } = $props();
  const ops = $derived(kind === "noteOps");
  /** Paramlocks: in jeder Klangspur, auch leer (dann nicht im Code). */
  const showLocks = $derived(kind === "effects" && track.type === "sound");

  const addLabel = $derived(
    ops ? "Mit Noten rechnen (add, div …)" : "Effekt oder Befehl hinzufügen",
  );

  let boxes = $state<HTMLElement>();

  /** Einfügeposition beim Ziehen einer Box (vor dem Entfernen), null = kein Ziehen. */
  let hint = $state<number | null>(null);

  function onHandleKey(e: KeyboardEvent, id: string, i: number) {
    const dir = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (dir === 0) return;
    e.preventDefault();
    const to = dir < 0 ? i - 1 : i + 2;
    if (to < 0 || to > track[kind].length) return;
    project.moveEffect(track.id, id, to, kind);
    // Fokus bleibt am Griff, auch nachdem die Box umgezogen ist
    requestAnimationFrame(() =>
      boxes
        ?.querySelector<HTMLElement>(`[data-effect-id="${id}"] .name`)
        ?.focus(),
    );
  }


  const messages = (effectId: string) => [
    ...new Set(
      project.parsedOf(effectId).errors.map((e) => PARSE_MESSAGES[e.code]),
    ),
  ];
</script>

<div class="effects">
  <div class="boxes" bind:this={boxes}>
    {#each track[kind] as fx, i (fx.id)}
      {@const info = valueInfo(fx.name)}
      {@const errors = messages(fx.id)}
      <div
        class="box"
        class:off={fx.tokens.length === 0 && !fx.rand && !fx.mod && !fx.lfo && !info?.noValue}
        class:bad={errors.length > 0}
        class:wide={!fx.rand && !fx.mod && !fx.lfo &&
          (session.mini.has(fx.id) ||
            (fx.tokens.length > 0 && singleValue(fx.tokens) === null))}
        class:before={hint === i}
        class:after={hint === i + 1 && i === track[kind].length - 1}
        data-effect-id={fx.id}
        animate:flip={{ duration: 150 }}
      >
        <EffectBox {fx} onremove={() => project.removeEffect(track.id, fx.id, kind)}>
          <div class="head">
            <!-- Griff: Ziehen verschiebt die Box, mit der Tastatur Pfeil links/rechts -->
            <span
              class="name"
              role="button"
              tabindex="0"
              title={info
                ? `${info.description}${info.hint ? ` (${info.hint})` : ""}`
                : undefined}
              aria-label={`${fx.name} verschieben (Pfeil links/rechts)`}
              onkeydown={(e) => onHandleKey(e, fx.id, i)}
              {@attach reorder(() => ({
                item: () =>
                  boxes?.querySelector<HTMLElement>(
                    `[data-effect-id="${fx.id}"]`,
                  ) ?? null,
                items: () => [
                  ...(boxes?.querySelectorAll<HTMLElement>(":scope > .box") ??
                    []),
                ],
                onHint: (index) => (hint = index),
                onDrop: (index) =>
                  project.moveEffect(track.id, fx.id, index, kind),
              }))}>{fx.name}</span
            >
          </div>
        </EffectBox>
        {#if errors.length > 0}
          <p class="error">{errors.join(" ")} Dieser Effekt ist aus.</p>
        {/if}
      </div>
    {/each}
    <button
      class="add"
      aria-label={addLabel}
      title={addLabel}
      aria-haspopup="dialog"
      onclick={() => (session.effectPicker = { trackId: track.id, kind })}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
    </button>
  </div>
  {#if showLocks}
    <LocksBox {track} />
  {/if}
</div>

<style>
  .effects {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
  }
  /* Effekte als kleine Boxen, von links umbrechend */
  .boxes {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 8px;
  }
  /* Eine Box: oben mittig der Titel (Griff zum Verschieben), darunter Drehknopf, Auswahl oder Wertsteine, dann der Modus; die rechte Kante blendet Zusatzfelder ein. Mit Wertsteinen wird sie breiter. */
  .box {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 96px;
    padding: 4px 4px 5px;
    /* border: 1.5px solid var(--val-edge); */
    border-radius: 8px;
    background: var(--box);
  }
  /* Mit Zusatzfeldern neben dem Knopf (rechte Kante der Box) oder Wertsteinen wird sie breiter, nie schmaler als mit Knopf */
  .box.wide,
  .box:has(:global(.fields)) {
    width: auto;
    min-width: 96px;
    max-width: 100%;
  }
  .box.bad {
    border-color: var(--red);
  }
  .box:global([data-dragging]) {
    z-index: 20;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
    pointer-events: none;
  }
  /* Einfügemarke beim Verschieben: ein Strich vor (oder nach der letzten) Box */
  .box.before::before,
  .box.after::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    border-radius: 2px;
    background: var(--blue);
  }
  .box.before::before {
    left: -7px;
  }
  .box.after::after {
    right: -7px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-bottom: 2px;
  }
  .name {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-weight: 600;
    padding: 0 2px;
  }
  /* Titel immer in Schriftfarbe, nicht in der Farbe des Modus */
  .box .name {
    color: var(--ink);
    text-align: center;
    flex: 1;
    min-width: 0;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: grab;
    /* Am Titel zieht der Finger die Box, die Seite scrollt hier nicht */
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .box:global([data-dragging]) .name {
    cursor: grabbing;
  }
  .error {
    max-width: 200px;
    margin: 4px 0 0;
    font-size: 11px;
    color: var(--red);
  }
  /* Plus am Ende: so hoch wie die Boxen seiner Zeile (allein wie eine Box mit Knopf), schmaler */
  .add {
    align-self: stretch;
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
</style>
