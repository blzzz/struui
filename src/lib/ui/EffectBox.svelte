<script lang="ts">
  import {
    fromRange,
    fromSlider,
    isRandSeries,
    isSliderRange,
    singleValue,
    sliderStep,
    splitParts,
    suggestRandSeries,
    suggestSliderRange,
    toRange,
    toSlider,
    valueInfo,
    valueScale,
    wholeValues,
  } from "../domain/effects.ts";
  import type { Effect, RandSeries } from "../domain/effects.ts";
  import { project } from "../state/project.svelte.ts";
  import { session } from "../state/session.svelte.ts";
  import EffectKnob from "./EffectKnob.svelte";
  import Lane from "./Lane.svelte";

  /**
   * Inhalt einer Effekt-Box unter dem Titel: ein grosser Drehknopf für eine einzelne Zahl (`EffectKnob`, langes Drücken
   * zum Eintippen), eine Auswahl für Namen, oder die Wertsteine (Mini-Notation, `<200 800>`, Zufall, Wiederholung).
   * Darunter in einer Reihe: der Modus («Wert», «Zufall», «Notation»; ein Klick öffnet die Auswahl), der Stift
   * (Zusatzfelder des Modus rechts vom Knopf ein und aus) und × (entfernen). «Wert»: min und max, erst Eintippen schreibt
   * Strudels `slider()` in den Code (Schritt aus `sliderStep`, der Knopf ist dann linear), ↺ macht daraus wieder die Zahl
   * allein; bis dahin blass mit dem Vorschlag aus den Beispielwerten. «Zufall» (`RandSeries`): min, max, Segmente und Zyklen,
   * der Knopf blättert durch den Offset (`#12`). «Notation»: die Wertsteine (`session.mini`), ohne Zusatzfelder.
   * Ist der Wert mehr als ein einzelner Stein, bleibt nur «Notation» (oder «Zufall»), bis nur noch einer übrig ist
   * (nichts geht verloren). Ohne Bereich liefern Strudels Beispielwerte die Skala des Knopfs (`valueScale`, als Marken
   * am Ring); eingetippt gehen auch Werte ausserhalb.
   * Effekte ohne Wert (`fit`) zeigen nur einen Hinweis. Strukturen (`struct("x ~ x")`) zeigen immer die Wertsteine,
   * Werte aus Teilen (`scale("C:minor")`) je Teil eine Auswahl.
   */
  let { fx, onRemove }: { fx: Effect; onRemove(): void } = $props();

  const info = $derived(valueInfo(fx.name));
  const scale = $derived(valueScale(info));
  const single = $derived(singleValue(fx.tokens));
  /** Mehr als ein Stein: nur als Mini-Notation darstellbar. */
  const forced = $derived(single === null && fx.tokens.length > 0);
  const mini = $derived(forced || !!info?.miniOnly || session.mini.has(fx.id));
  /** Die Teile des Werts (`C`, `minor`), wenn er aus Teilen besteht. */
  const parts = $derived(
    info?.parts ? splitParts(single ?? "", info.parts.length) : null,
  );

  function setPart(i: number, part: string) {
    if (!parts) return;
    project.setEffectValue(
      fx.id,
      parts.map((p, j) => (j === i ? part : p)).join(":"),
    );
  }

  const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;
  /** Der Wert als Zahl, sonst null (aus oder ein Name). */
  const value = $derived(
    single !== null && NUMBER.test(single) ? Number(single) : null,
  );

  /** Eingestellter Bereich (`slider()` im Code), sonst null. */
  const range = $derived(fx.slider ?? null);
  /** Was in den Feldern min und max steht: vor dem Einstellen der Vorschlag aus den Beispielwerten. */
  const shown = $derived(range ?? suggestSliderRange(info, value));
  /** Feld, dessen Eingabe gerade nicht gilt (`slider:min`, `rand:segments`; rot, bis sie gilt oder das Feld verlassen wird). */
  let badField = $state<string | null>(null);

  /** Zufallsreihe, wenn gewählt (steht dann statt der Steine im Code). */
  const rand = $derived(fx.rand ?? null);
  /** Was in den Feldern der Zufallsreihe steht: vor dem Wählen der Vorschlag. */
  const shownRand = $derived(rand ?? suggestRandSeries(info, value, range));
  /** Felder der Zufallsreihe; den Offset dreht der Knopf. */
  const RAND_FIELDS: { key: Exclude<keyof RandSeries, "whole" | "offset">; label: string }[] = [
    { key: "min", label: "min" },
    { key: "max", label: "max" },
    { key: "segments", label: "Segmente" },
    { key: "cycles", label: "Zyklen" },
  ];
  /** Der Knopf der Zufallsreihe dreht den Offset von 0 bis hier (eingetippt geht jeder). */
  const RAND_OFFSETS = 100;

  /** Wertsteine nicht mehr als Notation zeigen (nur wo sie gewählt war, nicht wo sie erzwungen ist). */
  function leaveMini() {
    if (session.mini.has(fx.id)) session.toggleMini(fx.id);
  }

  function onRandField(
    key: Exclude<keyof RandSeries, "whole" | "offset">,
    e: Event & { currentTarget: HTMLInputElement },
  ) {
    const text = normalize(e.currentTarget.value);
    const next = { ...shownRand, [key]: Number(text) };
    next.whole = wholeValues(info, next.min, next.max);
    if (!NUMBER.test(text) || !isRandSeries(next)) {
      badField = `rand:${key}`;
      return;
    }
    badField = null;
    // Eintippen schaltet auf «Zufallsreihe»
    leaveMini();
    project.setEffectRand(fx.id, next);
  }

  function setOffset(offset: number) {
    if (rand) project.setEffectRand(fx.id, { ...rand, offset });
  }

  function onRange(
    key: "min" | "max",
    e: Event & { currentTarget: HTMLInputElement },
  ) {
    const text = normalize(e.currentTarget.value);
    const bounds = { min: shown.min, max: shown.max, [key]: Number(text) };
    const next = { ...bounds, step: sliderStep(bounds.min, bounds.max) };
    if (!NUMBER.test(text) || !isSliderRange(next)) {
      badField = `slider:${key}`;
      return;
    }
    badField = null;
    // Eintippen in min oder max schaltet auf «Wertebereich»
    leaveMini();
    project.setEffectRand(fx.id, null);
    project.setEffectSlider(fx.id, next);
  }

  type Mode = "value" | "rand" | "mini";
  const MODES: { mode: Mode; label: string; title: string }[] = [
    { mode: "value", label: "Wert", title: "Ein Wert, mit min und max als slider() im Code" },
    { mode: "rand", label: "Zufall", title: "Zufallsreihe: rand.range(min, max).segment(n).ribbon(offset, zyklen)" },
    { mode: "mini", label: "Notation", title: "Wert als Mini-Notation (Wertsteine)" },
  ];
  const mode = $derived<Mode>(rand ? "rand" : mini ? "mini" : "value");
  const modeInfo = $derived(MODES.find((m) => m.mode === mode) ?? MODES[0]);
  /** Ein Wert aus Zahlen: Zufallsreihe möglich, und ohne mehrere Steine min und max des Werts. */
  const numeric = $derived(
    !info?.miniOnly && !info?.parts && scale.kind === "number",
  );
  const rangeFields = $derived(numeric && !forced);

  /** Modus wählbar: Notation immer, Wert nicht bei mehreren Steinen, Zufall nur bei Zahlen. */
  function allowed(m: Mode): boolean {
    if (m === "mini") return true;
    if (m === "rand") return numeric;
    return !(forced || info?.miniOnly);
  }
  /** Die wählbaren Modi. */
  const choices = $derived(MODES.filter((m) => allowed(m.mode)));

  function setMode(m: Mode) {
    if (m === mode || !allowed(m)) return;
    if (m !== "rand") project.setEffectRand(fx.id, null);
    if (m === "mini") {
      if (!mini) session.toggleMini(fx.id);
    } else leaveMini();
    if (m === "rand") project.setEffectRand(fx.id, shownRand);
  }

  /** Auswahl der Modi unter dem Modus-Knopf. */
  let menuOpen = $state(false);
  let menuRoot = $state<HTMLElement>();
  let trigger = $state<HTMLButtonElement>();

  $effect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRoot?.contains(e.target as Node)) menuOpen = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      menuOpen = false;
      trigger?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  });

  function choose(m: Mode) {
    setMode(m);
    menuOpen = false;
    trigger?.focus();
  }

  /** Zusatzfelder des Modus rechts vom Knopf (Stift). */
  let editing = $state(false);
  /** Hat der Modus Zusatzfelder: Wert bei Zahlen min und max, Zufall seine Angaben, Notation keine. */
  const hasFields = $derived(
    (mode === "value" && rangeFields) || (mode === "rand" && numeric),
  );
  const fieldsOpen = $derived(editing && hasFields);

  /** Stellung des Knopfs 0 … 1: im eingestellten Bereich linear, sonst über Strudels Beispielwerte. */
  const position = $derived.by(() => {
    if (value === null) return 0;
    if (range) return toRange(value, range);
    return scale.kind === "number" ? toSlider(value, scale.stops) : 0;
  });

  /** Marken am Ring: die Beispielwerte (gleichmässig verteilt), im eingestellten Bereich nur die Enden. */
  const marks = $derived.by(() => {
    if (range || scale.kind !== "number") return [0, 1];
    const last = scale.stops.length - 1;
    return scale.stops.map((_, i) => i / last);
  });

  function onTurn(pos: number) {
    if (range) project.setEffectValue(fx.id, String(fromRange(pos, range)));
    else if (scale.kind === "number")
      project.setEffectValue(fx.id, String(fromSlider(pos, scale.stops)));
  }

  /** Komma wie Punkt (deutsche Tastatur auf iOS). */
  const normalize = (text: string) => text.trim().replace(",", ".");

  /** Eingetippte Zahl (langes Drücken): ungültig oder leer bleibt alles, wie es war. */
  function onEdit(text: string): boolean {
    const t = normalize(text);
    if (!NUMBER.test(t)) return false;
    project.setEffectValue(fx.id, t);
    return true;
  }
</script>

<div class="main">
  <div class="value">
  {#if info?.noValue}
    <p class="hint none">ohne Wert</p>
  {:else if rand}
    <EffectKnob
      value={String(rand.offset)}
      display={`#${rand.offset}`}
      position={Math.min(1, Math.max(0, rand.offset / RAND_OFFSETS))}
      marks={[0, 1]}
      label={`${fx.name}, Zufallsreihe ${rand.min} bis ${rand.max}, Offset`}
      onTurn={(pos) => setOffset(Math.round(pos * RAND_OFFSETS))}
      onEdit={(text) => {
        const t = normalize(text);
        if (!NUMBER.test(t)) return false;
        setOffset(Number(t));
        return true;
      }}
      valid={(text) => NUMBER.test(normalize(text))}
    />
  {:else if mini}
    <Lane laneId={fx.id} tokens={fx.tokens} value />
  {:else if info?.parts && parts}
    {#each info.parts as choices, i (i)}
      <select
        class="num part"
        aria-label={`${fx.name}, ${i === 0 ? "Grundton" : "Art"}`}
        value={parts[i]}
        onchange={(e) => setPart(i, e.currentTarget.value)}
      >
        {#if parts[i] === ""}<option value="" disabled>aus</option>{/if}
        {#if parts[i] !== "" && !choices.includes(parts[i])}<option
            value={parts[i]}>{parts[i]}</option
          >{/if}
        {#each choices as choice (choice)}
          <option value={choice}>{choice.replaceAll(":", " ")}</option>
        {/each}
      </select>
    {/each}
  {:else if scale.kind === "number"}
    <EffectKnob
      value={single}
      {position}
      {marks}
      label={fx.name}
      {onTurn}
      {onEdit}
      valid={(text) => NUMBER.test(normalize(text))}
    />
  {:else}
    <select
      class="num"
      aria-label={`${fx.name}, Wert`}
      value={single ?? ""}
      onchange={(e) => project.setEffectValue(fx.id, e.currentTarget.value)}
    >
      {#if single === null}<option value="" disabled>aus</option>{/if}
      {#if single !== null && !scale.words.includes(single)}<option value={single}
          >{single}</option
        >{/if}
      {#each scale.words as word (word)}
        <option value={word}>{word}</option>
      {/each}
    </select>
  {/if}
  </div>
  {#if fieldsOpen && mode === "value"}
    <div
      class="fields"
      class:idle={!range}
      role="group"
      aria-label={`${fx.name}, Bereich des Reglers`}
    >
      {#each ["min", "max"] as const as key (key)}
        <label>
          <span>{key}</span>
          <input
            class="num"
            class:invalid={badField === `slider:${key}`}
            type="text"
            inputmode="decimal"
            spellcheck="false"
            autocomplete="off"
            value={String(shown[key])}
            oninput={(e) => onRange(key, e)}
            onblur={(e) => {
              if (badField === `slider:${key}`) badField = null;
              e.currentTarget.value = String(shown[key]);
            }}
          />
        </label>
      {/each}
      {#if range}
        <button
          class="reset"
          aria-label="Bereich zurücksetzen"
          title="Bereich zurücksetzen: wieder eine Zahl statt slider() im Code"
          onclick={() => project.setEffectSlider(fx.id, null)}>↺</button
        >
      {/if}
    </div>
  {:else if fieldsOpen && mode === "rand"}
    <div class="fields rand" role="group" aria-label={`${fx.name}, Zufallsreihe`}>
      {#each RAND_FIELDS as f (f.key)}
        <label>
          <span>{f.label}</span>
          <input
            class="num"
            class:invalid={badField === `rand:${f.key}`}
            type="text"
            inputmode={f.key === "segments" ? "numeric" : "decimal"}
            spellcheck="false"
            autocomplete="off"
            value={String(shownRand[f.key])}
            oninput={(e) => onRandField(f.key, e)}
            onblur={(e) => {
              if (badField === `rand:${f.key}`) badField = null;
              e.currentTarget.value = String(shownRand[f.key]);
            }}
          />
        </label>
      {/each}
    </div>
  {/if}
</div>
<div class="controls">
  {#if !info?.noValue}
    <div class="modewrap" bind:this={menuRoot}>
      <button
        bind:this={trigger}
        class="mode"
        class:set={mode !== "value" || range !== null}
        disabled={choices.length < 2}
        title={modeInfo.title}
        aria-label={`${fx.name}: Modus ${modeInfo.label}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onclick={() => (menuOpen = !menuOpen)}
      >
        {modeInfo.label}
      </button>
      {#if menuOpen}
        <div class="menu" role="menu" aria-label={`${fx.name}, Modus`}>
          {#each MODES as m (m.mode)}
            <button
              role="menuitemradio"
              aria-checked={mode === m.mode}
              disabled={!allowed(m.mode)}
              title={m.mode === "value" && forced
                ? "Nur ein einzelner Wert ohne Zufall und Wiederholung lässt sich als Regler zeigen"
                : m.title}
              onclick={() => choose(m.mode)}
            >
              <span class="check" aria-hidden="true"
                >{mode === m.mode ? "✓" : ""}</span
              >
              {m.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>
    <button
      class="icon"
      aria-pressed={fieldsOpen}
      disabled={!hasFields}
      title={mode === "rand"
        ? "min, max, Segmente und Zyklen (den Offset dreht der Knopf)"
        : "min und max (slider() im Code)"}
      aria-label={`${fx.name}: Einstellungen des Modus`}
      onclick={() => (editing = !editing)}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"
        ><path d="M11.5 2.5l2 2L6 12l-3 1 1-3z" /></svg
      >
    </button>
  {/if}
  <button
    class="icon remove"
    aria-label={`${fx.name} entfernen`}
    title="Effekt entfernen"
    onclick={onRemove}
  >
    <svg viewBox="0 0 16 16" aria-hidden="true"
      ><path d="M4 4l8 8M12 4l-8 8" /></svg
    >
  </button>
</div>

<style>
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
    font:
      16px ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
  }
  .num:focus {
    outline: none;
    border-color: var(--blue);
  }
  .num.invalid {
    border-color: var(--red);
  }
  .part + .part {
    margin-top: 3px;
  }
  /* Knopf (oder Auswahl, Wertsteine) und rechts daneben die Zusatzfelder */
  .main {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .value {
    flex: 1;
    min-width: 0;
  }
  /* Modus, Stift und × mittig unter dem Inhalt */
  .controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 2px;
    margin-top: 4px;
  }
  .modewrap {
    position: relative;
  }
  .mode {
    padding: 0 6px;
    border: 1px solid var(--line);
    border-radius: 3px;
    background: transparent;
    color: var(--mute);
    font:
      10px/16px ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
  }
  .mode.set,
  .mode[aria-expanded="true"] {
    border-color: var(--blue);
    background: color-mix(in srgb, var(--blue) 15%, transparent);
    color: var(--blue);
  }
  /* Auswahl der Modi unter dem Knopf */
  .menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px;
    min-width: 120px;
    background: var(--panel);
    border: 1.5px solid var(--line);
    border-radius: 8px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
  }
  .menu button {
    display: flex;
    align-items: baseline;
    gap: 6px;
    width: 100%;
    padding: 6px 8px;
    text-align: left;
    font-size: 14px;
    border-color: transparent;
    background: transparent;
    color: var(--ink);
  }
  .menu button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--blue) 14%, transparent);
  }
  .menu button:disabled {
    opacity: 0.45;
  }
  .menu button[aria-checked="true"] {
    font-weight: 700;
  }
  .check {
    width: 1em;
    flex: none;
  }
  .icon {
    display: grid;
    place-items: center;
    width: 20px;
    height: 18px;
    padding: 0;
    border-color: transparent;
    background: transparent;
    color: var(--mute);
  }
  .icon svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .icon[aria-pressed="true"] {
    color: var(--blue);
  }
  .icon.remove:hover {
    color: var(--red);
  }
  .mode:disabled,
  .icon:disabled {
    opacity: 0.4;
  }
  /* Zusatzfelder untereinander, jeweils ein kleiner Titel über dem Feld; Zufall zwei pro Zeile */
  .fields {
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 64px;
  }
  .fields.rand {
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 120px;
  }
  /* Noch kein Bereich eingestellt: der Vorschlag, blass */
  .fields.idle input:not(:focus) {
    opacity: 0.55;
  }
  .fields .num {
    font-size: 16px;
    padding: 1px 2px;
  }
  .fields .reset {
    align-self: center;
    padding: 0 4px;
    font-size: 14px;
    border-color: transparent;
    background: transparent;
    color: var(--mute);
  }
  .fields span {
    display: block;
    color: var(--mute);
    font:
      10px ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
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
