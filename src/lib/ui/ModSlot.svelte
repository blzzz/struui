<script lang="ts">
  import { knob } from '../interaction/knob.ts';
  import {
    BANG_VALUES,
    DEFAULT_BANG,
    DEFAULT_RANDOM,
    DEFAULT_STAR,
    DEFAULT_STEPS,
    DEFAULT_WEIGHT,
    RANDOM_VALUES,
    STAR_VALUES,
    STEPS_VALUES,
    WEIGHT_VALUES,
    angleFor,
    nearestIndex,
  } from '../domain/scales.ts';
  import type { CloseToken, Repeat, SoundToken } from '../domain/types.ts';

  /** `random` oben, `repeat` unten. `steps` ist der Modulowert unter `}` (statt Zufall und Wiederholung). */
  let { kind, token }: { kind: 'random' | 'repeat' | 'steps'; token: SoundToken | CloseToken } = $props();

  const REPEAT_VALUES: Record<Repeat['op'], readonly number[]> = { '*': STAR_VALUES, '!': BANG_VALUES, '@': WEIGHT_VALUES };
  const REPEAT_TONES: Record<Repeat['op'], string> = { '*': 'blue', '!': 'green', '@': 'orange' };

  const values = $derived<readonly number[]>(
    kind === 'random' ? RANDOM_VALUES : kind === 'steps' ? STEPS_VALUES : REPEAT_VALUES[token.repeat?.op ?? '*'],
  );
  const current = $derived(
    kind === 'random' ? token.random : kind === 'steps' ? ((token as CloseToken).steps ?? null) : (token.repeat?.value ?? null),
  );
  const active = $derived(current !== null);
  const stage = $derived(current === null ? -1 : nearestIndex(values, current));
  /** Mitte des Knopfs: nur der Operator. */
  const symbol = $derived(kind === 'random' ? '?' : kind === 'steps' ? '%' : (token.repeat?.op ?? ''));
  const label = $derived(current === null ? '' : format(current));
  const tone = $derived(kind === 'random' ? 'red' : kind === 'steps' ? 'br3' : REPEAT_TONES[token.repeat?.op ?? '*']);
  const labels = { random: 'Zufall', repeat: 'Wiederholung', steps: 'Schritte pro Zyklus' };

  // Geometrie im SVG (Einheiten, der Knopf füllt --s): Körper, Ring mit Raststufen, Beschriftung
  const BODY = 10.5;
  const RING = 15;
  const FRACTIONS: Record<string, string> = { '0.125': '⅛', '0.25': '¼', '0.5': '½', '1.5': '1½' };

  /** Kleine Zahl an der aktuellen Raststufe. Zufall wie im Code (`.25`), sonst Brüche als Zeichen. */
  function format(v: number): string {
    if (kind === 'random') return String(v).replace(/^0\./, '.');
    return FRACTIONS[String(v)] ?? String(v);
  }

  /** Punkt auf dem Ring für eine Raststufe (0° = oben, im Uhrzeigersinn). */
  function point(i: number, r: number): { x: number; y: number } {
    const a = (angleFor(i, values.length) * Math.PI) / 180;
    return { x: r * Math.sin(a), y: -r * Math.cos(a) };
  }
  const placeholders = { random: '?', repeat: '*!@', steps: '%' };

  /** Tippen: Zufall und Modulo an/aus. Wiederholung: aus, Stern, Ausrufezeichen, Gewicht, aus. */
  function tap() {
    if (kind === 'random') {
      token.random = token.random === null ? DEFAULT_RANDOM : null;
    } else if (kind === 'steps') {
      const close = token as CloseToken;
      close.steps = close.steps === null ? DEFAULT_STEPS : null;
    } else {
      const r = token.repeat;
      token.repeat =
        r === null
          ? { op: '*', value: DEFAULT_STAR }
          : r.op === '*'
            ? { op: '!', value: DEFAULT_BANG }
            : r.op === '!'
              ? { op: '@', value: DEFAULT_WEIGHT }
              : null;
    }
  }

  function setStage(i: number) {
    const value = values[i];
    if (kind === 'random') token.random = value;
    else if (kind === 'steps') (token as CloseToken).steps = value;
    else if (token.repeat) token.repeat = { op: token.repeat.op, value };
  }
</script>

<div
  class="slot {kind}"
  role="button"
  tabindex="0"
  aria-label={active ? `${labels[kind]} ${symbol}${current}` : `${labels[kind]} aus`}
  {@attach knob(() => ({ active: () => active, stageCount: () => values.length, onTap: tap, onStage: setStage }))}
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
      {@const w = 4 + label.length * 4}
      <rect class="pill" x={p.x - w / 2} y={p.y - 4.5} width={w} height="9" rx="4.5" />
      <text class="num" x={p.x} y={p.y} dy="0.35em">{label}</text>
    {:else}
      <circle class="ph" r={BODY} />
      <text class="op ph-text" dy="0.35em">{placeholders[kind]}</text>
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
