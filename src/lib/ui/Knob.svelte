<script lang="ts">
  import { knob } from '../interaction/knob.ts';
  import { angleFor, nearestIndex } from '../domain/scales.ts';

  /**
   * Drehknopf eines Operators (`?`, `*`, `!`, `@`, `%`): in der Mitte das Zeichen, am Ring die Raststufen, die aktuelle
   * mit ihrer Zahl. Tippen schaltet, Drehen wählt die Stufe. Grösse aus `--s`.
   */
  let {
    values,
    current,
    symbol,
    label,
    tone,
    placeholder,
    text,
    onTap,
    onStage,
  }: {
    values: readonly number[];
    /** null = aus (gestrichelter Platzhalter). */
    current: number | null;
    symbol: string;
    /** Name für Screenreader (`Wiederholung`). */
    label: string;
    /** Farbe: red, blue, green, orange, br3. */
    tone: string;
    placeholder: string;
    /** Zahl an der Stufe. */
    text: (v: number) => string;
    onTap(): void;
    onStage(index: number): void;
  } = $props();

  const active = $derived(current !== null);
  const stage = $derived(current === null ? -1 : nearestIndex(values, current));
  const num = $derived(current === null ? '' : text(current));

  // Geometrie im SVG (Einheiten, der Knopf füllt --s): Körper, Ring mit Raststufen, Beschriftung
  const BODY = 10.5;
  const RING = 15;

  /** Punkt auf dem Ring für eine Raststufe (0° = oben, im Uhrzeigersinn). */
  function point(i: number, r: number): { x: number; y: number } {
    const a = (angleFor(i, values.length) * Math.PI) / 180;
    return { x: r * Math.sin(a), y: -r * Math.cos(a) };
  }
</script>


<div
  class="slot"
  role="button"
  tabindex="0"
  aria-label={active ? `${label} ${symbol}${current}` : `${label} aus`}
  {@attach knob(() => ({ active: () => active, stageCount: () => values.length, onTap, onStage }))}
>
  <svg viewBox="-18 -18 36 36" class={active ? tone : 'off'} aria-hidden="true">
    {#if active}
      {#each values as _, i (i)}
        {#if i !== stage}
          {@const p = point(i, RING)}
          <circle class="tick" cx={p.x} cy={p.y} r="1.3" />
        {/if}
      {/each}
      <circle class="body" r={BODY} />
      {@const n = point(stage, 1)}
      <line class="notch" x1={n.x * 6.5} y1={n.y * 6.5} x2={n.x * (BODY - 1.5)} y2={n.y * (BODY - 1.5)} />
      <text class="op" dy="0.35em">{symbol}</text>
      {@const p = point(stage, RING)}
      {@const w = 4 + num.length * 4}
      <rect class="pill" x={p.x - w / 2} y={p.y - 4.5} width={w} height="9" rx="4.5" />
      <text class="num" x={p.x} y={p.y} dy="0.35em">{num}</text>
    {:else}
      <circle class="ph" r={BODY} />
      <text class="op ph-text" dy="0.35em">{placeholder}</text>
    {/if}
  </svg>
</div>

<style>
  .slot {
    position: relative;
    width: var(--s);
    height: var(--s);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;
    border-radius: 50%;
    transition: transform 0.15s ease-out;
  }
  /* Beim Drehen grösser, damit Ring und Zahl unter dem Finger sichtbar bleiben */
  .slot:global([data-turning]) {
    transform: scale(1.6);
    z-index: 10;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
    /* Die Zahl darf über den Rand ragen */
    overflow: visible;
    font-family: inherit;
  }
  .red { --tone: var(--red); }
  .blue { --tone: var(--blue); }
  .green { --tone: var(--green); }
  .orange { --tone: var(--orange); }
  .br3 { --tone: var(--br3); }
  .tick {
    fill: var(--mute);
  }
  .body {
    fill: var(--tone);
    stroke: rgba(0, 0, 0, 0.25);
    stroke-width: 1.5;
  }
  .notch {
    stroke: rgba(255, 255, 255, 0.9);
    stroke-width: 2;
    stroke-linecap: round;
  }
  .op {
    text-anchor: middle;
    fill: #fff;
    font-size: 10px;
    font-weight: 700;
  }
  .pill {
    fill: var(--tone);
    stroke: var(--panel);
    stroke-width: 1.2;
  }
  .num {
    text-anchor: middle;
    fill: #fff;
    font-size: 6.5px;
    font-weight: 700;
  }
  .ph {
    fill: none;
    stroke: var(--line);
    stroke-width: 1.3;
    stroke-dasharray: 2.5 2;
  }
  .ph-text {
    fill: var(--mute);
    font-size: 7px;
    font-weight: 500;
  }
</style>
