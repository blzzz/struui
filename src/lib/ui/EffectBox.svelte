<script lang="ts">
  import { fromSlider, isSliderRange, singleValue, suggestSliderRange, toSlider, valueInfo, valueScale } from '../domain/effects.ts';
  import type { Effect, SliderRange } from '../domain/effects.ts';
  import { project } from '../state/project.svelte.ts';
  import { session } from '../state/session.svelte.ts';
  import Lane from './Lane.svelte';

  /**
   * Inhalt einer Effekt-Box unter dem Titel: Regler und Zahlenfeld für einen einzelnen Wert, oder die Wertsteine
   * (Mini-Notation, `<200 800>`, Zufall, Wiederholung). Der kleine Schalter «mini» wechselt zwischen beidem.
   * Ist der Wert mehr als ein einzelner Stein, bleiben die Wertsteine, bis nur noch einer übrig ist (nichts geht verloren).
   * Den Bereich des Reglers liefern Strudels Beispielwerte (`valueScale`); das Zahlenfeld nimmt auch Werte ausserhalb.
   * «edit» stellt min, max und step ein (`fx.slider`): dann ist der Regler linear wie Strudels `slider()`, das so im Code steht.
   * Effekte ohne Wert (`fit`) zeigen nur einen Hinweis.
   */
  let { fx }: { fx: Effect } = $props();

  const info = $derived(valueInfo(fx.name));
  const scale = $derived(valueScale(info));
  const single = $derived(singleValue(fx.tokens));
  /** Mehr als ein Stein: nur als Mini-Notation darstellbar. */
  const forced = $derived(single === null && fx.tokens.length > 0);
  const mini = $derived(forced || session.mini.has(fx.id));

  /** Feinheit des Reglers (Schritte über die ganze Breite). */
  const RESOLUTION = 1000;
  const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;

  /** Eingestellter Bereich (`slider()` im Code), sonst null. */
  const range = $derived(fx.slider ?? null);
  /** Felder für min, max und step offen. */
  let editing = $state(false);
  /** Was in den drei Feldern steht: vor dem Einstellen der Vorschlag aus den Beispielwerten. */
  const shown = $derived(range ?? suggestSliderRange(info, single !== null && NUMBER.test(single) ? Number(single) : null));
  /** Feld, dessen Eingabe gerade nicht gilt (rot, bis sie gilt oder das Feld verlassen wird). */
  let badField = $state<keyof SliderRange | null>(null);

  function onRange(key: keyof SliderRange, e: Event & { currentTarget: HTMLInputElement }) {
    const text = e.currentTarget.value.trim();
    const next = { ...shown, [key]: Number(text) };
    if (!NUMBER.test(text) || !isSliderRange(next)) {
      badField = key;
      return;
    }
    badField = null;
    project.setEffectSlider(fx.id, next);
  }

  const position = $derived.by(() => {
    if (scale.kind !== 'number' || single === null || !NUMBER.test(single)) return 0;
    return Math.round(toSlider(Number(single), scale.stops) * RESOLUTION);
  });

  /** Eingabe im Zahlenfeld, die (noch) keine Zahl ist: bleibt stehen und ist rot, bis sie gilt oder das Feld verlassen wird. */
  let invalid = $state(false);

  function onSlide(e: Event & { currentTarget: HTMLInputElement }) {
    if (scale.kind !== 'number') return;
    project.setEffectValue(fx.id, String(fromSlider(Number(e.currentTarget.value) / RESOLUTION, scale.stops)));
  }

  function onType(e: Event & { currentTarget: HTMLInputElement }) {
    const text = e.currentTarget.value.trim();
    invalid = !NUMBER.test(text);
    if (!invalid) project.setEffectValue(fx.id, text);
  }
</script>

{#if info?.noValue}
  <p class="hint none">ohne Wert</p>
{:else if mini}
  <Lane laneId={fx.id} tokens={fx.tokens} value />
{:else if scale.kind === 'number'}
  {#if range}
    <!-- Eingestellter Bereich: linear wie Strudels slider() -->
    <input
      class="slider"
      type="range"
      min={range.min}
      max={range.max}
      step={range.step}
      value={single ?? range.min}
      class:unset={single === null}
      aria-label={`${fx.name}, Regler`}
      aria-valuetext={single ?? 'aus'}
      oninput={(e) => project.setEffectValue(fx.id, e.currentTarget.value)}
    />
  {:else}
    <input
      class="slider"
      type="range"
      min="0"
      max={RESOLUTION}
      step="1"
      value={position}
      class:unset={single === null}
      aria-label={`${fx.name}, Regler`}
      aria-valuetext={single ?? 'aus'}
      oninput={onSlide}
    />
  {/if}
  <input
    class="num"
    class:invalid
    type="text"
    inputmode="decimal"
    spellcheck="false"
    autocomplete="off"
    placeholder="aus"
    aria-label={`${fx.name}, Wert`}
    value={single ?? ''}
    oninput={onType}
    onblur={(e) => {
      invalid = false;
      e.currentTarget.value = single ?? '';
    }}
  />
{:else}
  <select
    class="num"
    aria-label={`${fx.name}, Wert`}
    value={single ?? ''}
    onchange={(e) => project.setEffectValue(fx.id, e.currentTarget.value)}
  >
    {#if single === null}<option value="" disabled>aus</option>{/if}
    {#if single !== null && !scale.words.includes(single)}<option value={single}>{single}</option>{/if}
    {#each scale.words as word (word)}
      <option value={word}>{word}</option>
    {/each}
  </select>
{/if}
{#if editing && !mini && scale.kind === 'number'}
  <div class="range" role="group" aria-label={`${fx.name}, Bereich des Reglers`}>
    {#each [['min', 'min'], ['max', 'max'], ['step', 'step']] as const as [key, text] (key)}
      <label>
        <span>{text}</span>
        <input
          class="num"
          class:invalid={badField === key}
          type="text"
          inputmode="decimal"
          spellcheck="false"
          autocomplete="off"
          value={String(shown[key])}
          oninput={(e) => onRange(key, e)}
          onblur={(e) => {
            if (badField === key) badField = null;
            e.currentTarget.value = String(shown[key]);
          }}
        />
      </label>
    {/each}
    {#if range}
      <button class="pill" onclick={() => project.setEffectSlider(fx.id, null)} title="Wieder eine Zahl statt slider() im Code">
        kein slider
      </button>
    {:else}
      <p class="hint">Eine Änderung schreibt slider() in den Code.</p>
    {/if}
  </div>
{/if}
{#if !info?.noValue}
<div class="pills">
  {#if !mini && scale.kind === 'number'}
    <button
      class="pill"
      class:set={range !== null}
      aria-expanded={editing}
      title={range ? `slider(…, ${range.min}, ${range.max}, ${range.step}) im Code` : 'Bereich des Reglers einstellen (slider)'}
      onclick={() => (editing = !editing)}
    >
      edit
    </button>
  {/if}
<button
  class="pill"
  aria-pressed={mini}
  disabled={forced}
  title={forced ? 'Nur ein einzelner Wert ohne Zufall und Wiederholung lässt sich als Regler zeigen' : 'Wert als Mini-Notation (Wertsteine)'}
  onclick={() => session.toggleMini(fx.id)}
>
  mini
</button>
</div>
{/if}

<style>
  .slider {
    width: 100%;
    margin: 4px 0 2px;
    accent-color: var(--blue);
    /* Waagrecht ziehen bedient den Regler, senkrecht scrollt die Seite */
    touch-action: pan-y;
  }
  .slider.unset {
    opacity: 0.4;
  }
  .num {
    width: 100%;
    min-width: 0;
    padding: 2px 4px;
    border: 1.5px solid var(--val-edge);
    border-radius: 5px;
    background: var(--val);
    color: var(--val-ink);
    text-align: center;
    /* 16px verhindert das automatische Zoomen auf iOS */
    font: 16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .num:focus {
    outline: none;
    border-color: var(--blue);
  }
  .num.invalid {
    border-color: var(--red);
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-top: 4px;
  }
  .pill {
    padding: 0 5px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: transparent;
    color: var(--mute);
    font: 10px/16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .pill[aria-pressed='true'],
  .pill.set {
    border-color: var(--blue);
    background: color-mix(in srgb, var(--blue) 15%, transparent);
    color: var(--blue);
  }
  .pill:disabled {
    opacity: 0.6;
  }
  /* min, max, step untereinander, jeweils ein kleiner Titel über dem Feld */
  .range {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    margin-top: 6px;
    padding-top: 4px;
    border-top: 1px dashed var(--val-edge);
  }
  .range label {
    width: 100%;
  }
  .range span {
    display: block;
    color: var(--mute);
    font: 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .hint {
    margin: 0;
    color: var(--mute);
    font-size: 10px;
    line-height: 1.2;
  }
  .hint.none {
    margin: 4px 0 2px;
  }
</style>
