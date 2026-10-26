<script lang="ts">
  import { flushSync } from "svelte";
  import { knob } from "../interaction/knob.ts";
  import { angleForPosition } from "../domain/scales.ts";

  /**
   * Grosser stufenloser Drehknopf für den Wert eines Effekts (eine einzelne Zahl, keine Mini-Notation). In der Mitte die Zahl,
   * am Ring der Bogen bis zur Stellung und kleine Marken (Strudels Beispielwerte). Ziehen im Bogen um die Mitte dreht,
   * langes Drücken öffnet ein Feld für eine beliebige Zahl (gilt beim Bestätigen, ungültig rot umrandet).
   * Mit der Tastatur: Pfeile drehen in Hundertsteln, Enter öffnet das Feld. Grösse aus `--s`.
   */
  let {
    value,
    display,
    position,
    marks,
    label,
    onTurn,
    onEdit,
    valid,
  }: {
    /** Wert wie im Code, null = aus (gestrichelt). */
    value: string | null;
    /** Text in der Mitte, wenn anders als der Wert (`#12`). Eingetippt wird der Wert. */
    display?: string;
    /** Stellung 0 … 1. */
    position: number;
    /** Stellungen der Marken am Ring, 0 … 1. */
    marks: readonly number[];
    /** Name für Screenreader (`lpf`). */
    label: string;
    onTurn(position: number): void;
    /** Eingetippter Wert: true, wenn er gültig war und übernommen wurde. */
    onEdit(text: string): boolean;
    /** Prüft die Eingabe beim Tippen (für die rote Umrandung). */
    valid(text: string): boolean;
  } = $props();

  let editing = $state(false);
  let draft = $state("");
  let input = $state<HTMLInputElement>();
  /** Escape: Feld schliessen, ohne zu übernehmen. */
  let cancel = false;

  function startEdit() {
    draft = value ?? "";
    cancel = false;
    editing = true;
    flushSync();
    input?.focus();
    input?.select();
  }

  function finishEdit() {
    if (!editing) return;
    editing = false;
    if (!cancel) onEdit(draft);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter") input?.blur();
    else if (e.key === "Escape") {
      cancel = true;
      input?.blur();
    }
  }

  function onSlotKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest("input")) return;
    const dir =
      e.key === "ArrowUp" || e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowDown" || e.key === "ArrowLeft"
          ? -1
          : 0;
    if (dir !== 0) {
      e.preventDefault();
      onTurn(Math.min(1, Math.max(0, position + dir * 0.01)));
    } else if (e.key === "Enter") startEdit();
  }

  const active = $derived(value !== null);

  // Geometrie im SVG (Einheiten, der Knopf füllt --s): Körper, Ring mit Bogen, Marken knapp ausserhalb
  const BODY = 12;
  const RING = 15.5;
  const MARK = 17.6;

  function point(pos: number, r: number): { x: number; y: number } {
    const a = (angleForPosition(pos) * Math.PI) / 180;
    return { x: r * Math.sin(a), y: -r * Math.cos(a) };
  }

  /** Bogen am Ring von Stellung `from` bis `to`. */
  function arc(from: number, to: number): string {
    const a = point(from, RING);
    const b = point(to, RING);
    const large = (to - from) * 270 > 180 ? 1 : 0;
    return `M ${a.x} ${a.y} A ${RING} ${RING} 0 ${large} 1 ${b.x} ${b.y}`;
  }

  /** Lange Zahlen kleiner, damit sie in den Körper passen. */
  const shownText = $derived(display ?? value ?? "aus");
  const fontSize = $derived(
    value === null ? 6 : Math.min(8, 30 / Math.max(shownText.length, 1)),
  );
</script>

<div
  class="slot"
  role="slider"
  tabindex="0"
  aria-label={label}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={Math.round(position * 100)}
  aria-valuetext={value ?? "aus"}
  onkeydown={onSlotKey}
  {@attach knob(() => ({
    active: () => true,
    stageCount: () => 0,
    onTap: () => {},
    onStage: () => {},
    onTurn,
    position: () => position,
    onLongPress: startEdit,
    // Noch in der Geste fokussieren, sonst öffnet iOS keine Tastatur
    onLongRelease: () => {
      input?.focus();
      input?.select();
    },
  }))}
>
  {#if editing}
    <input
      bind:this={input}
      type="text"
      inputmode="decimal"
      bind:value={draft}
      size={Math.max(draft.length, 3) + 1}
      aria-label={label}
      aria-invalid={draft.trim() !== "" ? !valid(draft) : false}
      spellcheck="false"
      autocomplete="off"
      onkeydown={onKey}
      onblur={finishEdit}
    />
  {/if}
  <svg viewBox="-20 -20 40 40" class:off={!active} aria-hidden="true">
    {#each marks as m, i (i)}
      {@const p = point(m, MARK)}
      <circle class="mark" cx={p.x} cy={p.y} r="0.8" />
    {/each}
    <path class="track" d={arc(0, 1)} />
    {#if active && position > 0.002}
      <path class="fill" d={arc(0, position)} />
    {/if}
    <circle class="body" r={BODY} />
    {#if active}
      {@const n = point(position, 1)}
      <line
        class="notch"
        x1={n.x * (BODY - 4)}
        y1={n.y * (BODY - 4)}
        x2={n.x * (BODY - 1.2)}
        y2={n.y * (BODY - 1.2)}
      />
    {/if}
    <text class="num" dy="0.35em" font-size={fontSize}>{shownText}</text>
  </svg>
</div>

<style>
  .slot {
    position: relative;
    width: var(--s, 64px);
    height: var(--s, 64px);
    margin: 0 auto;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;
    border-radius: 50%;
  }
  .slot:focus-visible {
    outline: 2px solid var(--blue);
    outline-offset: 2px;
  }
  /* Feld mittig über dem Knopf, in einer verkleinerten Reihe in normaler Grösse (wie beim Operator-Knopf) */
  input {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 13;
    zoom: calc(1 / var(--fit, 1));
    width: auto;
    min-width: 48px;
    height: 32px;
    padding: 0 6px;
    border: none;
    border-radius: 8px;
    outline: 3px solid var(--blue);
    background: var(--panel);
    color: var(--ink);
    text-align: center;
    user-select: text;
    -webkit-user-select: text;
    /* 16px verhindert das automatische Zoomen auf iOS */
    font:
      700 16px ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
  }
  input[aria-invalid="true"] {
    outline-color: var(--red);
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .mark {
    /* fill: var(--mute); */
  }
  .track,
  .fill {
    fill: none;
    stroke-width: 2.4;
    stroke-linecap: round;
  }
  .track {
    stroke: var(--line);
  }
  .off .track {
    stroke-dasharray: 2.5 2;
  }
  .fill {
    stroke: var(--blue);
  }
  .body {
    fill: var(--val);
    stroke: var(--val-edge);
    stroke-width: 1.2;
  }
  .off .body {
    fill: none;
    stroke: var(--line);
    stroke-dasharray: 2.5 2;
  }
  .notch {
    stroke: var(--blue);
    stroke-width: 1.8;
    stroke-linecap: round;
  }
  .num {
    text-anchor: middle;
    fill: var(--val-ink);
    font-weight: 700;
  }
  .off .num {
    fill: var(--mute);
    font-weight: 500;
  }
</style>
