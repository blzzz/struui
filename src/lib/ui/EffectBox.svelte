<script lang="ts">
  import type { Snippet } from "svelte";
  import {
    fromRange,
    fromSlider,
    WAVES,
    LFO_SHAPES,
    convertLfoDepth,
    isLfoSeries,
    isModSeries,
    isRandSeries,
    isSliderRange,
    singleValue,
    sliderStep,
    splitParts,
    suggestLfoSeries,
    suggestModSeries,
    suggestRandSeries,
    suggestSliderRange,
    toRange,
    toSlider,
    valueInfo,
    valueScale,
    wholeValues,
  } from "../domain/effects.ts";
  import type {
    Effect,
    LfoSeries,
    LfoShape,
    ModSeries,
    RandSeries,
    Wave,
  } from "../domain/effects.ts";
  import { project } from "../state/project.svelte.ts";
  import { session } from "../state/session.svelte.ts";
  import { dragNumber } from "../interaction/drag-number.ts";
  import DotToggle from "./DotToggle.svelte";
  import EffectKnob from "./EffectKnob.svelte";
  import Lane from "./Lane.svelte";
  import LaneToggles from "./LaneToggles.svelte";

  /**
   * Inhalt einer Effekt-Box unter dem Titel: ein grosser Drehknopf für eine einzelne Zahl (`EffectKnob`, ein Klick
   * zum Eintippen), eine Auswahl für Namen, oder die Wertsteine (Mini-Notation, `<200 800>`, Zufall, Wiederholung).
   * Titel (`children`), Knopf und Modus stehen links beisammen, die Zusatzfelder rechts über die ganze Höhe.
   * Unter dem Knopf der Modus («Wert», «Zufall», «Welle», «LFO», «Notation»; ein Klick öffnet die Auswahl). Die rechte Kante der Box
   * (18px) blendet die Zusatzfelder des Modus rechts vom Knopf ein und aus. Entfernen: Box markieren, dann Delete (`EffectList`). «Wert»: min und max, erst Eintippen schreibt
   * Strudels `slider()` in den Code (Schritt aus `sliderStep`, der Knopf ist dann linear), ↺ macht daraus wieder die Zahl
   * allein; bis dahin blass mit dem Vorschlag aus den Beispielwerten. «Zufall» (`RandSeries`): min, max, Segmente, ribbon
   * (an/aus) und Zyklen, der Knopf (beschriftet «Offset») blättert durch den Offset (`#12`, ohne ribbon «frei»; Drehen schaltet ribbon ein). «Welle» (`ModSeries`): Welle, min, max und Segmente, der Knopf
   * (beschriftet «Dauer (Zyklen)») stellt die Dauer einer Periode in Zyklen ein (`↻4`, rastet bei `SLOWS` ein). «LFO» (`LfoSeries`,
   * Strudels `lfo` nach dem Wert, nur bei modulierbaren Effekten): Form, Wert (um den er schwingt), Tempo (sync pro Zyklus oder
   * Hz), Tiefe (relativ oder absolut), Lage (dcoffset) und skew; der Knopf (beschriftet «Tiefe») dreht die Tiefe (`depthSpan`).
   * «Notation»: die Wertsteine (`session.mini`), ohne Zusatzfelder.
   * Ist der Wert mehr als ein einzelner Stein, bleibt nur «Notation» (oder «Zufall»), bis nur noch einer übrig ist
   * (nichts geht verloren). Ohne Bereich liefern Strudels Beispielwerte die Skala des Knopfs (`valueScale`, als Marken
   * am Ring); eingetippt gehen auch Werte ausserhalb.
   * Effekte ohne Wert (`fit`) zeigen nur einen Hinweis. Strukturen (`struct("x ~ x")`) zeigen immer die Wertsteine,
   * Werte aus Teilen (`scale("C:minor")`) je Teil eine Auswahl.
   */
  /** `children`: der Titel der Box (Griff zum Verschieben, aus `EffectList`), steht über dem Knopf. */
  /** `onremove`: entfernt die Box, als Knopf über ihr, solange die Auswahl der Modi offen ist. */
  let {
    fx,
    children,
    onremove,
  }: { fx: Effect; children?: Snippet; onremove?: () => void } = $props();

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
  /** Der Knopf der Zufallsreihe dreht den Offset von 0 bis hier (eingetippt geht jeder). */
  const RAND_OFFSETS = 100;

  /** Ziehen an einem Zahlenfeld: Schritt, kleinster Wert, Pixel pro Schritt (`dragNumber`). */
  type Drag = { step: number; min?: number; px?: number };
  const SEGMENT_DRAG: Drag = { step: 1, min: 1, px: 8 };
  const CYCLE_DRAG: Drag = { step: 0.5, min: 0.5, px: 8 };

  /** Wertsteine nicht mehr als Notation zeigen (nur wo sie gewählt war, nicht wo sie erzwungen ist). */
  function leaveMini() {
    if (session.mini.has(fx.id)) session.toggleMini(fx.id);
  }

  function onRandField(
    key: Exclude<keyof RandSeries, "whole" | "offset">,
    input: string,
  ) {
    const text = normalize(input);
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

  /** Offset am Knopf: schaltet ribbon ein (ohne ribbon gäbe es keinen Offset). */
  function setOffset(offset: number) {
    if (rand) project.setEffectRand(fx.id, { ...rand, offset, ribbon: true });
  }

  function setRibbon(ribbon: boolean) {
    if (rand) project.setEffectRand(fx.id, { ...rand, ribbon });
  }

  /** Modulation, wenn gewählt (steht dann statt der Steine im Code). */
  const mod = $derived(fx.mod ?? null);
  /** Was in den Feldern der Modulation steht: vor dem Wählen der Vorschlag. */
  const shownMod = $derived(mod ?? suggestModSeries(info, value, range));
  /** Dauer einer Periode in Zyklen, auf die der Knopf der Modulation einrastet (eingetippt geht jede über 0). */
  const SLOWS = [0.25, 0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32];

  function onModField(key: "min" | "max" | "segments", input: string) {
    const text = normalize(input);
    const next = { ...shownMod, [key]: Number(text) };
    next.whole = wholeValues(info, next.min, next.max);
    if (!NUMBER.test(text) || !isModSeries(next)) {
      badField = `mod:${key}`;
      return;
    }
    badField = null;
    project.setEffectMod(fx.id, next);
  }

  function setMod(change: Partial<ModSeries>) {
    if (mod) project.setEffectMod(fx.id, { ...mod, ...change });
  }

  /** Stellung des Knopfs der Modulation: die Dauer zwischen den Rastwerten, darüber hinaus am Rand. */
  const slowPosition = $derived.by(() => {
    if (!mod) return 0;
    const i = SLOWS.findIndex((v) => v >= mod.slow);
    return (i < 0 ? SLOWS.length - 1 : i) / (SLOWS.length - 1);
  });

  /** LFO, wenn gewählt (steht nach dem Wert im Code). */
  const lfo = $derived(fx.lfo ?? null);
  /** Was in den Feldern des LFO steht: vor dem Wählen der Vorschlag. */
  const shownLfo = $derived(lfo ?? suggestLfoSeries());
  /** Ziehen an Lage und skew: in Zwanzigsteln. */
  const FRACTION_DRAG: Drag = { step: 0.05, px: 6 };
  const SPEED_DRAG: Drag = { step: 0.05, min: 0.05, px: 6 };

  function onLfoField(
    key: "speed" | "depth" | "dcoffset" | "skew",
    input: string,
  ) {
    const text = normalize(input);
    const next = { ...shownLfo, [key]: Number(text) };
    if (!NUMBER.test(text) || !isLfoSeries(next)) {
      badField = `lfo:${key}`;
      return;
    }
    badField = null;
    project.setEffectLfo(fx.id, next);
  }

  function setLfo(change: Partial<LfoSeries>) {
    if (lfo) project.setEffectLfo(fx.id, { ...lfo, ...change });
  }

  /** Relativ oder absolut: die Tiefe so umrechnen, dass der Ausschlag bleibt. */
  function setAbsolute(absolute: boolean) {
    if (lfo) setLfo({ absolute, depth: convertLfoDepth(lfo, absolute, value) });
  }

  /** Bereich des Werts beim LFO (eingestellt oder aus den Beispielwerten). */
  const lfoRange = $derived(range ?? suggestSliderRange(info, value));
  /** Der Knopf dreht die Tiefe von 0 bis hier: relativ bis 2 (von 0 bis zum doppelten Wert), absolut die Breite des Bereichs. */
  const depthSpan = $derived(
    shownLfo.absolute ? lfoRange.max - lfoRange.min : 2,
  );
  const depthStep = $derived(
    shownLfo.absolute ? sliderStep(lfoRange.min, lfoRange.max) : 0.01,
  );
  /** Stellung des Knopfs beim LFO: die Tiefe, linear bis `depthSpan`, darüber (eingetippt) am Rand. */
  const depthPosition = $derived(
    lfo ? Math.min(1, lfo.depth / depthSpan) : 0,
  );

  /** Tiefe aus der Stellung des Knopfs: auf den Schritt gerundet, mindestens ein Schritt (0 wäre kein LFO). */
  function turnDepth(pos: number) {
    const depth = Number(
      (Math.round((pos * depthSpan) / depthStep) * depthStep).toPrecision(12),
    );
    setLfo({ depth: Math.max(depthStep, depth) });
  }

  function onRange(key: "min" | "max", input: string) {
    const text = normalize(input);
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

  type Mode = "value" | "rand" | "mod" | "lfo" | "mini";
  const MODES: { mode: Mode; label: string; title: string }[] = [
    {
      mode: "value",
      label: "Wert",
      title: "Ein Wert, mit min und max als slider() im Code",
    },
    {
      mode: "rand",
      label: "Zufall",
      title:
        "Zufallsreihe: rand.range(min, max).segment(n).ribbon(offset, zyklen)",
    },
    {
      mode: "mod",
      label: "Welle",
      title: "Modulation: sine.range(min, max).segment(n).slow(zyklen)",
    },
    {
      mode: "lfo",
      label: "LFO",
      title:
        "Strudels LFO im Klang, um den Wert: .lfo({ shape, sync, depth })",
    },
    {
      mode: "mini",
      label: "Notation",
      title: "Wert als Mini-Notation (Wertsteine)",
    },
  ];
  const mode = $derived<Mode>(
    rand ? "rand" : mod ? "mod" : lfo ? "lfo" : mini ? "mini" : "value",
  );
  const modeInfo = $derived(MODES.find((m) => m.mode === mode) ?? MODES[0]);
  /** Ein Wert aus Zahlen: Zufallsreihe möglich, und ohne mehrere Steine min und max des Werts. */
  const numeric = $derived(
    !info?.miniOnly && !info?.parts && scale.kind === "number",
  );
  const rangeFields = $derived(numeric && !forced);

  /**
   * Modus wählbar: Notation immer, Wert nicht bei mehreren Steinen, Zufall und Modulation nur bei Zahlen, LFO bei einer Zahl
   * und nur, wenn Strudel den Effekt modulieren kann.
   */
  function allowed(m: Mode): boolean {
    if (m === "mini") return true;
    if (m === "rand" || m === "mod") return numeric;
    if (m === "lfo") return numeric && !forced && !!info?.modulatable;
    return !(forced || info?.miniOnly);
  }
  /** Die wählbaren Modi. */
  const choices = $derived(MODES.filter((m) => allowed(m.mode)));

  function setMode(m: Mode) {
    if (m === mode || !allowed(m)) return;
    if (m !== "rand") project.setEffectRand(fx.id, null);
    if (m !== "mod") project.setEffectMod(fx.id, null);
    if (m !== "lfo") project.setEffectLfo(fx.id, null);
    // Der LFO schwingt um den Wert: ohne Wert die Mitte des Bereichs
    if (m === "lfo" && value === null) {
      const step = sliderStep(lfoRange.min, lfoRange.max);
      const mid = Math.round((lfoRange.min + lfoRange.max) / 2 / step) * step;
      project.setEffectValue(fx.id, String(Number(mid.toPrecision(12))));
    }
    if (m === "mini") {
      if (!mini) session.toggleMini(fx.id);
    } else leaveMini();
    if (m === "rand") project.setEffectRand(fx.id, shownRand);
    if (m === "mod") project.setEffectMod(fx.id, shownMod);
    if (m === "lfo") project.setEffectLfo(fx.id, shownLfo);
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

  /** Zusatzfelder des Modus rechts vom Knopf (rechte Kante der Box). */
  let editing = $state(false);
  /** Hat der Modus Zusatzfelder: Wert bei Zahlen min und max, Zufall, Modulation und LFO ihre Angaben, Notation keine. */
  const hasFields = $derived(
    (mode === "value" && rangeFields) ||
      ((mode === "rand" || mode === "mod" || mode === "lfo") && numeric),
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

  /** Eingetippte Zahl (Klick auf den Knopf): ungültig oder leer bleibt alles, wie es war. */
  function onEdit(text: string): boolean {
    const t = normalize(text);
    if (!NUMBER.test(t)) return false;
    project.setEffectValue(fx.id, t);
    return true;
  }
</script>

<div
  class="main"
  class:edged={hasFields}
  style:--mode-ink={info?.noValue ? undefined : `var(--mode-${mode})`}
>
  <!-- Links Titel, Knopf und Modus beisammen, rechts die Zusatzfelder über die ganze Höhe -->
  <div class="left">
    {@render children?.()}
    <!-- Bei Zufall, Welle und LFO (Knopf mit Beschriftung) Bogen und Strich in der Farbe des Modus -->
    <div
      class="value"
      style:--knob-ink={rand || mod || lfo ? "var(--mode-ink)" : undefined}
    >
      {#if info?.noValue}
        <p class="hint none">ohne Wert</p>
      {:else if rand}
        <EffectKnob
          value={String(rand.offset)}
          display={rand.ribbon ? String(rand.offset) : "–"}
          position={rand.ribbon
            ? Math.min(1, Math.max(0, rand.offset / RAND_OFFSETS))
            : 0}
          marks={[0, 1]}
          label={`${fx.name}, Zufallsreihe ${rand.min} bis ${rand.max}, Offset${rand.ribbon ? "" : " (ribbon aus)"}`}
          onTurn={(pos) => setOffset(Math.round(pos * RAND_OFFSETS))}
          onEdit={(text) => {
            const t = normalize(text);
            if (!NUMBER.test(t)) return false;
            setOffset(Number(t));
            return true;
          }}
          valid={(text) => NUMBER.test(normalize(text))}
        />
        <span class="knob-cap">Offset</span>
      {:else if mod}
        {@const m = mod}
        <EffectKnob
          value={String(m.slow)}
          display={`${m.slow}`}
          position={slowPosition}
          marks={SLOWS.map((_, i) => i / (SLOWS.length - 1))}
          label={`${fx.name}, Modulation ${m.wave} ${m.min} bis ${m.max}, Dauer in Zyklen`}
          onTurn={(pos) =>
            setMod({ slow: SLOWS[Math.round(pos * (SLOWS.length - 1))] })}
          onEdit={(text) => {
            const t = normalize(text);
            if (!NUMBER.test(t) || Number(t) <= 0) return false;
            setMod({ slow: Number(t) });
            return true;
          }}
          valid={(text) =>
            NUMBER.test(normalize(text)) && Number(normalize(text)) > 0}
        />
        <span class="knob-cap">Zyklen</span>
      {:else if lfo}
        {@const l = lfo}
        <EffectKnob
          value={String(l.depth)}
          display={String(l.depth)}
          position={depthPosition}
          marks={[0, 0.25, 0.5, 0.75, 1]}
          label={`${fx.name}, LFO ${l.shape} um ${single}, Tiefe${l.absolute ? " absolut" : ""}`}
          onTurn={turnDepth}
          onEdit={(text) => {
            const t = normalize(text);
            if (!NUMBER.test(t) || Number(t) <= 0) return false;
            setLfo({ depth: Number(t) });
            return true;
          }}
          valid={(text) =>
            NUMBER.test(normalize(text)) && Number(normalize(text)) > 0}
        />
        <span class="knob-cap">Tiefe</span>
      {:else if mini}
        <!-- Eigene Schalter für Zufall und Wiederholung, wie links vom Notationseditor der Spur -->
        <div
          class="lane"
          class:norandom={!session.random.has(fx.id)}
          class:noknobs={session.noKnobs.has(fx.id)}
        >
          {#if fx.tokens.length > 0}
            <LaneToggles id={fx.id} />
          {/if}
          <Lane laneId={fx.id} tokens={fx.tokens} value />
        </div>
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
          {#if single !== null && !scale.words.includes(single)}<option
              value={single}>{single}</option
            >{/if}
          {#each scale.words as word (word)}
            <option value={word}>{word}</option>
          {/each}
        </select>
      {/if}
    </div>
    {#if !info?.noValue || onremove}
      <div class="controls">
        <div class="modewrap" bind:this={menuRoot}>
          <button
            bind:this={trigger}
            class="mode"
            disabled={choices.length < 2 && !onremove}
            title={info?.noValue ? "Entfernen" : modeInfo.title}
            aria-label={info?.noValue
              ? `${fx.name}: Menü`
              : `${fx.name}: Modus ${modeInfo.label}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onclick={() => (menuOpen = !menuOpen)}
          >
            {info?.noValue ? "···" : modeInfo.label}
          </button>
          {#if menuOpen && onremove}
            <!-- Entfernen: über der Box, solange die Auswahl offen ist -->
            <button
              class="remove"
              aria-label={`${fx.name} entfernen`}
              title={`${fx.name} entfernen`}
              onclick={() => {
                menuOpen = false;
                onremove();
              }}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true"
                ><path
                  d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5M7 7v4M9 7v4"
                /></svg
              >
            </button>
          {/if}
          {#if menuOpen && !info?.noValue}
            <div class="menu" role="menu" aria-label={`${fx.name}, Modus`}>
              <!-- Der aktuelle Modus steht schon im Reiter: nur die anderen, dafür grösser -->
              {#each MODES.filter((m) => m.mode !== mode) as m (m.mode)}
                <button
                  role="menuitem"
                  disabled={!allowed(m.mode)}
                  title={m.mode === "value" && forced
                    ? "Nur ein einzelner Wert ohne Zufall und Wiederholung lässt sich als Regler zeigen"
                    : m.title}
                  style:--mode-ink={`var(--mode-${m.mode})`}
                  onclick={() => choose(m.mode)}
                >
                  {m.label}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
  {#if fieldsOpen && mode === "value"}
    <div
      class="fields"
      class:idle={!range}
      role="group"
      aria-label={`${fx.name}, Bereich des Reglers`}
    >
      <!-- min über max statt nebeneinander: nutzt die Höhe, die Box bleibt schmal -->
      {#each ["min", "max"] as const as key (key)}
        <div class="group">
          <span class="cap short">{key}</span>
          {@render field(
            `slider:${key}`,
            key,
            String(shown[key]),
            (t) => onRange(key, t),
            { step: sliderStep(shown.min, shown.max) },
          )}
          {#if key === "max" && range}
            <button
              class="reset"
              aria-label="Bereich zurücksetzen"
              title="Bereich zurücksetzen: wieder eine Zahl statt slider() im Code"
              onclick={() => project.setEffectSlider(fx.id, null)}>↺</button
            >
          {/if}
        </div>
      {/each}
    </div>
  {:else if fieldsOpen && mode === "rand"}
    <div class="fields" role="group" aria-label={`${fx.name}, Zufallsreihe`}>
      <div class="group">
        <span class="cap">Bereich</span>
        {@render range2("rand", shownRand, onRandField)}
      </div>
      <div class="group">
        <span class="cap">Segmente</span>
        {@render field(
          "rand:segments",
          "Segmente",
          String(shownRand.segments),
          (t) => onRandField("segments", t),
          SEGMENT_DRAG,
          "numeric",
        )}
      </div>
      <div class="group" class:muted={!shownRand.ribbon}>
        <span class="cap">
          <DotToggle
            pressed={shownRand.ribbon}
            title="ribbon: dieselbe Reihe immer wieder (den Offset dreht der Knopf)"
            onclick={() => setRibbon(!shownRand.ribbon)}>ribbon</DotToggle
          >
        </span>
        {@render field(
          "rand:cycles",
          "Zyklen",
          String(shownRand.cycles),
          (t) => onRandField("cycles", t),
          CYCLE_DRAG,
          "decimal",
          !shownRand.ribbon,
        )}
        <span class="unit">Zyklen</span>
      </div>
    </div>
  {:else if fieldsOpen && mode === "mod"}
    <div class="fields" role="group" aria-label={`${fx.name}, Modulation`}>
      <div class="group">
        <span class="cap">Welle</span>
        <select
          class="num wave"
          aria-label="Welle"
          value={shownMod.wave}
          onchange={(e) => setMod({ wave: e.currentTarget.value as Wave })}
        >
          {#each WAVES as w (w)}
            <option value={w}>{w}</option>
          {/each}
        </select>
      </div>
      <div class="group">
        <span class="cap">Bereich</span>
        {@render range2("mod", shownMod, onModField)}
      </div>
      <div class="group">
        <span class="cap">Segmente</span>
        {@render field(
          "mod:segments",
          "Segmente",
          String(shownMod.segments),
          (t) => onModField("segments", t),
          SEGMENT_DRAG,
          "numeric",
        )}
      </div>
    </div>
  {:else if fieldsOpen && mode === "lfo"}
    <div class="fields" role="group" aria-label={`${fx.name}, LFO`}>
      <div class="group">
        <span class="cap">Form</span>
        <select
          class="num wave"
          aria-label="Form (shape)"
          value={shownLfo.shape}
          onchange={(e) =>
            setLfo({ shape: e.currentTarget.value as LfoShape })}
        >
          {#each LFO_SHAPES as w (w)}
            <option value={w}>{w}</option>
          {/each}
        </select>
      </div>
      <div class="group">
        <span class="cap">Wert</span>
        {@render field(
          "lfo:value",
          "Wert, um den der LFO schwingt",
          single ?? "",
          (t) => {
            if (onEdit(t)) badField = null;
            else badField = "lfo:value";
          },
          { step: sliderStep(lfoRange.min, lfoRange.max) },
        )}
      </div>
      <div class="group">
        <span class="cap">
          <DotToggle
            pressed={shownLfo.unit === "sync"}
            title="sync: Perioden pro Zyklus, bleibt im Takt; aus: rate in Hz"
            onclick={() =>
              setLfo({ unit: shownLfo.unit === "sync" ? "rate" : "sync" })}
            >sync</DotToggle
          >
        </span>
        {@render field(
          "lfo:speed",
          shownLfo.unit === "sync" ? "Perioden pro Zyklus (sync)" : "Schwingungen pro Sekunde (rate)",
          String(shownLfo.speed),
          (t) => onLfoField("speed", t),
          SPEED_DRAG,
        )}
        <span class="unit">{shownLfo.unit === "sync" ? "/Zyklus" : "Hz"}</span>
      </div>
      <div class="group">
        <span class="cap">
          <DotToggle
            pressed={shownLfo.absolute}
            title="depthabs: Tiefe in der Einheit des Werts (400 = 200 nach oben und unten); aus: relativ zum Wert (1 = halber Wert)"
            onclick={() => setAbsolute(!shownLfo.absolute)}>absolut</DotToggle
          >
        </span>
        {@render field(
          "lfo:depth",
          shownLfo.absolute ? "Tiefe absolut (depthabs)" : "Tiefe relativ zum Wert (depth)",
          String(shownLfo.depth),
          (t) => onLfoField("depth", t),
          { step: depthStep, min: depthStep },
        )}
      </div>
      <div class="group">
        <span class="cap">Lage</span>
        {@render field(
          "lfo:dcoffset",
          "Lage (dcoffset): -0.5 um den Wert, 0 nur nach oben, -1 nur nach unten",
          String(shownLfo.dcoffset),
          (t) => onLfoField("dcoffset", t),
          FRACTION_DRAG,
        )}
      </div>
      <div class="group" class:muted={shownLfo.shape !== "tri" && shownLfo.shape !== "square"}>
        <span class="cap">skew</span>
        {@render field(
          "lfo:skew",
          "skew (0 bis 1): Spitze bei tri, Pulsbreite bei square",
          String(shownLfo.skew),
          (t) => onLfoField("skew", t),
          { ...FRACTION_DRAG, min: 0 },
          "decimal",
          shownLfo.shape !== "tri" && shownLfo.shape !== "square",
        )}
      </div>
    </div>
  {/if}
</div>
{#snippet field(
  id: string,
  label: string,
  text: string,
  onText: (text: string) => void,
  drag: Drag,
  inputmode: "decimal" | "numeric" = "decimal",
  disabled = false,
)}
  <input
    class="num"
    class:invalid={badField === id}
    type="text"
    {inputmode}
    aria-label={label}
    title={label}
    spellcheck="false"
    autocomplete="off"
    {disabled}
    value={text}
    oninput={(e) => onText(e.currentTarget.value)}
    onblur={(e) => {
      if (badField === id) badField = null;
      e.currentTarget.value = text;
    }}
    {@attach dragNumber(() => ({
      value: () => Number(text),
      step: () => drag.step,
      min: drag.min === undefined ? undefined : () => drag.min as number,
      px: drag.px === undefined ? undefined : () => drag.px as number,
      onChange: (v) => onText(String(v)),
    }))}
  />
{/snippet}
<!-- min – max einer Gruppe; `prefix` wie in `badField`. Ziehen in Schritten von etwa einem Hundertstel des Bereichs. -->
{#snippet range2(
  prefix: string,
  values: { min: number; max: number },
  onText: (key: "min" | "max", text: string) => void,
)}
  {@const drag = { step: sliderStep(values.min, values.max) }}
  {@render field(
    `${prefix}:min`,
    "min",
    String(values.min),
    (t) => onText("min", t),
    drag,
  )}
  <span class="unit">–</span>
  {@render field(
    `${prefix}:max`,
    "max",
    String(values.max),
    (t) => onText("max", t),
    drag,
  )}
{/snippet}
{#if hasFields}
  <!-- Rechte Kante der Box: Zusatzfelder des Modus ein und aus -->
  <button
    class="edge"
    style:--mode-ink={`var(--mode-${mode})`}
    aria-expanded={fieldsOpen}
    aria-label={`${fx.name}: Einstellungen des Modus`}
    title={mode === "rand"
      ? "min, max, Segmente und Zyklen (den Offset dreht der Knopf)"
      : mode === "mod"
        ? "Welle, min, max und Segmente (die Dauer dreht der Knopf)"
        : mode === "lfo"
          ? "Form, Wert, Tempo, Tiefe, Lage und skew (die Tiefe dreht der Knopf)"
          : "min und max (slider() im Code)"}
    onclick={() => (editing = !editing)}
  >
    <svg viewBox="0 0 8 16" aria-hidden="true"
      ><path d={fieldsOpen ? "M5.5 4L2.5 8l3 4" : "M2.5 4l3 4-3 4"} /></svg
    >
  </button>
{/if}

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
  /*
   * Wird die Box schmaler, als Knopf und Zusatzfelder nebeneinander brauchen (die Box ist höchstens so breit wie die
   * Effektliste, auf dem Handy schnell erreicht), rutschen die Felder unter den Knopf, statt über die Box hinauszuragen.
   */
  .main {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 6px;
  }
  .left {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  /*
   * Mit Kante ist die linke Spalte immer gleich breit, ob die Zusatzfelder offen sind oder nicht, damit der Knopf beim
   * Öffnen und Schliessen nicht springt: Box 96px abzüglich Innenabstand (2 × 4px) und Platz für die Kante (14px).
   */
  .main.edged .left {
    flex: none;
    width: 74px;
  }
  /* Modus mittig unter dem Knopf, klebt als dunkler Reiter am unteren Rand der Box (deren Innenabstand unten 5px) */
  .controls {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    margin-top: auto;
    margin-bottom: -5px;
    padding-top: 4px;
  }
  /* Nicht positioniert: die Auswahl richtet sich nach der Box (`.box` in `EffectList` ist position: relative) */
  .modewrap {
    position: static;
  }
  /* Schriftfarbe je Modus (`--mode-ink`) */
  .mode {
    padding: 0 8px;
    border: none;
    border-radius: 5px 5px 0 0;
    background: color-mix(in srgb, var(--bg) 75%, transparent);
    color: var(--mode-ink, var(--ink));
    font:
      10px/16px ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
  }
  .mode:hover:not(:disabled),
  .mode[aria-expanded="true"] {
    background: var(--bg);
  }
  /*
   * Auswahl der Modi: klappt vom Reiter nach oben auf und füllt die Box, dunkel wie der Reiter,
   * jeder Modus in seiner Farbe. Mit offenen Zusatzfeldern nur über der linken Spalte (so gross wie die Box zu).
   */
  .menu {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 1px;
    padding: 4px 0px;
    border-radius: 8px;
    overflow: hidden;
    background: var(--bg);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
    transform-origin: bottom;
    animation: dropup 120ms ease-out;
  }
  /* Entfernen: schwebt mittig über der Box (`.box` in `EffectList` ist position: relative) */
  .remove {
    position: absolute;
    bottom: calc(100% + 4px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 21;
    width: 34px;
    height: 34px;
    padding: 0;
    display: grid;
    place-items: center;
    background: var(--panel);
    border: 1.5px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
    color: var(--ink);
    animation: dropup 120ms ease-out;
  }
  .remove:hover {
    color: var(--red);
  }
  .remove svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  @media (pointer: coarse) {
    .remove {
      width: 42px;
      height: 42px;
    }
  }
  @keyframes dropup {
    from {
      transform: scaleY(0.3);
      opacity: 0;
    }
  }
  .main:has(.fields) .menu {
    right: auto;
    width: 88px;
  }
  .menu button {
    flex: 1 1 0;
    max-height: 40px;
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 0;
    padding: 0 10px;
    text-align: left;
    font:
      600 13px ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
    border: none;
    border-radius: 0px;
    background: transparent;
    color: var(--mode-ink, var(--ink));
  }
  .menu button:hover:not(:disabled),
  .menu button:focus-visible {
    outline: none;
    background: color-mix(
      in srgb,
      var(--mode-ink, var(--ink)) 16%,
      transparent
    );
  }
  .menu button:disabled {
    opacity: 0.35;
  }
  /* Rechte Kante der Box (die Box ist position: relative): Zusatzfelder ein und aus */
  /* In der Farbe des Modus: immer leicht getönt, beim Zeigen und offen kräftiger */
  .edge {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 18px;
    display: grid;
    place-items: center;
    padding: 0;
    border: none;
    border-left: 1px solid color-mix(in srgb, var(--mode-ink) 25%, transparent);
    border-radius: 0 8px 8px 0;
    background: color-mix(in srgb, var(--mode-ink) 10%, transparent);
    color: color-mix(in srgb, var(--mode-ink) 70%, transparent);
    cursor: pointer;
  }
  .edge:hover,
  .edge:focus-visible {
    border-left-color: color-mix(in srgb, var(--mode-ink) 55%, transparent);
    background: color-mix(in srgb, var(--mode-ink) 22%, transparent);
    color: var(--mode-ink);
    outline: none;
  }
  .edge[aria-expanded="true"] {
    border-left-color: color-mix(in srgb, var(--mode-ink) 45%, transparent);
    background: color-mix(in srgb, var(--mode-ink) 18%, transparent);
    color: var(--mode-ink);
  }
  .edge svg {
    width: 8px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  /* Platz für die Kante */
  .main.edged {
    margin-right: 14px;
  }
  /* Offene Zusatzfelder: kleiner Abstand vor der Kante (18px, davon 4px im Innenabstand der Box) */
  .main.edged:has(.fields) {
    margin-right: 20px;
  }
  /* Nur ein Modus möglich: bleibt lesbar in seiner Farbe, nur leiser */
  .mode:disabled {
    opacity: 0.6;
  }
  /*
   * Zusatzfelder in Gruppen untereinander (Bereich, Segmente, ribbon, Welle): je eine Zeile mit kleinem Titel links,
   * leise abgesetzt, damit Knopf und Wertsteine vorne bleiben. Klein am Desktop, 16px bei Touch (iOS zoomt sonst).
   */
  /* Füllt die Höhe der Box: die Gruppen teilen sie sich, die Felder sind fest so hoch wie die Wertsteine (`--field-h`) */
  .fields {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
    font-size: 15px;
  }
  @media (pointer: coarse) {
    .fields {
      font-size: 16px;
    }
  }
  /* Mindestens so hoch wie ein Feld samt Innenabstand; wird die Box höher, teilen sich die Gruppen den Platz */
  .group {
    flex: 1 1 0;
    min-height: calc(var(--field-h) + 4px);
    max-height: 38px;
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 2px 2px 2px 5px;
    border-radius: 4px;
    /* Leicht in der Farbe des Modus getönt (Wert: weiss, also neutral wie bisher) */
    background: color-mix(in srgb, var(--mode-ink, var(--ink)) 8%, transparent);
  }
  /* Was der Knopf bei Zufall und Welle einstellt, klein darunter */
  .knob-cap {
    display: block;
    margin-top: 1px;
    text-align: center;
    color: color-mix(in srgb, var(--mode-ink, var(--ink)) 35%, var(--mute));
    font:
      9px/1.2 ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
    white-space: nowrap;
  }
  .cap {
    width: 6em;
    flex: none;
    color: color-mix(in srgb, var(--mode-ink, var(--ink)) 35%, var(--mute));
    font:
      9px/1.2 ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
    white-space: nowrap;
    align-self: center;
  }
  /* Nur «min», «max»: schmale Titelspalte */
  .cap.short {
    width: 2.6em;
  }
  .unit {
    align-self: center;
    color: var(--mute);
    font-size: 9px;
  }
  /* Hoch und runter ziehen ändert die Zahl, Tippen setzt den Cursor */
  /* So hoch wie die Wertsteine (`--field-h`) */
  .fields .num {
    width: 4em;
    height: var(--field-h);
    padding: 1px 3px;
    cursor: ns-resize;
    touch-action: none;
    border: 1px solid transparent;
    border-radius: 3px;
    background: color-mix(in srgb, var(--mode-ink, var(--ink)) 9%, transparent);
    color: var(--ink);
    font-size: inherit;
    line-height: 1.4;
  }
  .fields .num:focus,
  .fields select.num {
    cursor: auto;
  }
  .fields .num:global([data-dragging]) {
    border-color: var(--blue);
    cursor: ns-resize;
  }
  .fields .num:hover:not(:disabled) {
    border-color: var(--line);
  }
  .fields .num:focus {
    border-color: var(--blue);
  }
  .fields .num.invalid {
    border-color: var(--red);
  }
  .fields .wave {
    /* So breit wie min – max darunter */
    width: calc(8em + 12px);
    text-align: left;
  }
  .fields .num:disabled,
  .group.muted .unit {
    opacity: 0.4;
  }
  /* Noch kein Bereich eingestellt: der Vorschlag, blass */
  .fields.idle .num:not(:focus) {
    opacity: 0.55;
  }
  .reset {
    align-self: center;
    padding: 0 3px;
    font-size: 12px;
    line-height: 1;
    border-color: transparent;
    background: transparent;
    color: var(--mute);
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

  /* Schalter links, Steine rechts daneben */
  .lane {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-top: 4px;
  }
  .lane > :global(.lane) {
    flex: 1;
    min-width: 0;
  }
</style>
