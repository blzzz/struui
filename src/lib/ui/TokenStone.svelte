<script lang="ts">
  import { flushSync, untrack } from 'svelte';
  import { isValueAtom, singleValue, stepValue } from '../domain/effects.ts';
  import { DEFAULT_VOICE, isNote, stepNote } from '../domain/notes.ts';
  import { isSoundName, stepVariant } from '../domain/sounds.ts';
  import { tokenGestures } from '../interaction/token-gestures.ts';
  import { CLOSING, hasModifiers, hasSteps, isPause, label } from '../domain/types.ts';
  import { playback } from '../state/playback.svelte.ts';
  import { project } from '../state/project.svelte.ts';
  import { session } from '../state/session.svelte.ts';
  import type { GroupType, Repeat, Token } from '../domain/types.ts';

  /** `value`: Stein in einer Effektreihe, er trägt einen Wert statt eines Klangs. */
  let {
    token,
    laneId,
    error,
    value = false,
    replacing = false,
    stacking = false,
    spanned = false,
    stackPrev = false,
    stackNext = false,
  }: {
    token: Token;
    laneId: string;
    error: boolean;
    value?: boolean;
    /** Ein Stein aus der Palette schwebt darüber und würde ihn ersetzen. */
    replacing?: boolean;
    /** Ein Stein aus der Palette verweilt darüber und würde mit Komma angefügt (`[bd, hh]`). */
    stacking?: boolean;
    /** Stapel: hängt am Stein davor bzw. der nächste hängt an ihm (eckige Ecken auf dieser Seite). */
    stackPrev?: boolean;
    stackNext?: boolean;
    /** Umschliessen im Gang: der Stein liegt im Bereich, den das Klammerpaar fassen würde. */
    spanned?: boolean;
  } = $props();

  const lit = $derived(session.lit.has(token.id));
  const BRACKET_TONES: Record<GroupType, string> = { '[': 'br1', '<': 'br2', '{': 'br3' };
  /** Kompaktansicht: Farbe des Strichs unten. */
  const REPEAT_MARKS: Record<Repeat['op'], string> = { '*': 'b', '!': 'g', '@': 'o' };

  const tone = $derived(
    token.kind === 'sound'
      ? isPause(token)
        ? 'pause'
        : value
          ? 'val'
          : 'snd'
      : token.kind === 'raw'
        ? 'raw'
        : BRACKET_TONES[token.group],
  );
  const text = $derived(label(token));
  const fontSize = $derived(token.kind !== 'sound' ? null : text.length > 7 ? '8px' : text.length > 4 ? '10px' : '12px');

  /**
   * Wertsteine werden direkt bearbeitet: Tippen öffnet ein Feld im Stein, jede gültige Eingabe gilt sofort.
   * ↑/↓ (oder − und +) springen zum nächsten Wert aus Strudels Beispielen. Langes Drücken öffnet den Dialog.
   */
  /** Notenstein (Notenspur): bearbeitet sich wie ein Wert, ↑/↓ gehen einen Halbton weiter. Pausen nicht. */
  const notes = $derived(!value && project.contentOf(laneId) === 'notes');
  /**
   * Klangstein: ebenso, Tippen öffnet ein Feld für den Namen, wahlweise mit Variante (`bd:3`).
   * ↑/↓ und −/+ zählen die Variante. Pausen nicht. Langes Drücken öffnet wie bei Noten das Menü.
   */
  const editable = $derived(token.kind === 'sound' && (value || !isPause(token)));
  /** Positionen einer Sampler-Spur mit `scrub`: auch mit Geschwindigkeit nach dem Doppelpunkt (`.5:2`). */
  const lists = $derived(value && project.valueLists(laneId));
  const valid = (text: string) => (notes ? isNote(text) : value ? isValueAtom(text, lists) : isSoundName(text));
  const values = $derived(value ? (project.lane(laneId)?.info?.values ?? []) : []);
  /** Zahlentastatur, wenn Strudels Beispiele nur Zahlen ab 0 zeigen. Nicht bei Listen: Sie hat keinen Doppelpunkt. */
  const numeric = $derived(!lists && values.length > 0 && values.every((v) => /^(\d+\.?\d*|\.\d+)$/.test(v)));
  let editing = $state(false);
  let draft = $state('');
  let before = '';
  let input = $state<HTMLInputElement>();

  // Eben über das + angehängt (Note oder Wert): gleich offen. Das + fokussiert das Feld noch in seiner Geste (iOS-Tastatur).
  untrack(() => {
    if (editable && token.kind === 'sound' && session.editNew === token.id) {
      session.editNew = null;
      before = draft = token.sound;
      editing = true;
    }
  });

  function startEdit() {
    if (token.kind !== 'sound') return;
    before = draft = token.sound;
    editing = true;
    // Noch in der Geste fokussieren, sonst öffnet iOS keine Tastatur
    flushSync();
    input?.focus();
    input?.select();
  }

  function apply(next: string) {
    draft = next;
    if (valid(next.trim())) project.setValue(laneId, token.id, next.trim());
  }

  function step(dir: 1 | -1) {
    const current = token.kind === 'sound' ? token.sound : draft;
    apply(notes ? stepNote(current, dir) : value ? stepValue(current, values, dir) : stepVariant(current, dir));
    audition();
  }

  /**
   * Ohne Wiedergabe spielt Tippen den Stein einmal an: einen Klang (auch den Klang einer Notenspur oder das Sample einer
   * Sampler-Spur), eine Note mit dem Klang ihrer Spur. Nicht bei Pausen, Werten und MIDI-Spuren (die klingen nicht im Browser).
   */
  function audition() {
    if (session.playing || token.kind !== 'sound' || isPause(token)) return;
    const lane = project.lane(laneId);
    if (!lane || lane.track.type === 'midi') return;
    if (lane.content === 'sounds' && isSoundName(token.sound)) void playback.preview(token.sound);
    else if (lane.content === 'notes' && isNote(token.sound))
      void playback.preview(singleValue(lane.track.voice.tokens) ?? DEFAULT_VOICE, token.sound);
  }

  /**
   * Andere Steine öffnen beim Tippen ein Menü darüber: Entfernen. Ersetzen geht durch Ziehen eines Klangs aus der Palette
   * auf den Stein. Bei Klammern wählt das Menü zusätzlich die Klammerart des Paars, Entfernen löst das Paar auf.
   */
  const menuOpen = $derived(session.menu?.laneId === laneId && session.menu.tokenId === token.id);
  const bracket = $derived(token.kind === 'open' || token.kind === 'close' ? token.group : null);
  let root = $state<HTMLElement>();

  $effect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!root?.contains(e.target as Node)) session.menu = null;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') session.menu = null;
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  });

  function removeIt() {
    session.menu = null;
    editing = false;
    if (bracket) project.unwrap(laneId, token.id);
    else project.removeToken(laneId, token.id);
  }

  /** Umschliessen im Gang in dieser Reihe: Antippen wählt den Stein, bis zu dem das Paar reicht. */
  const picking = $derived(session.wrap?.laneId === laneId);
  const anchor = $derived(picking && session.wrap?.tokenId === token.id);

  /** Antippen während des Umschliessens schliesst es ab. Gibt true zurück, wenn der Tipp dafür verbraucht wurde. */
  function finishWrap(): boolean {
    const w = session.wrap;
    if (!w || w.laneId !== laneId) return false;
    session.wrap = null;
    project.wrapRange(laneId, w.tokenId, token.id, w.group);
    return true;
  }

  function hover(on: boolean) {
    const w = session.wrap;
    if (!w || w.laneId !== laneId) return;
    if (on) w.hoverId = token.id;
    else if (w.hoverId === token.id) w.hoverId = null;
  }

  function chooseGroup(group: GroupType) {
    session.menu = null;
    project.setGroup(laneId, token.id, group);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') input?.blur();
    else if (e.key === 'Escape') {
      apply(before);
      input?.blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      step(e.key === 'ArrowUp' ? 1 : -1);
    }
  }
</script>

<div
  bind:this={root}
  class="slot"
  class:wide={token.kind === 'raw'}
  class:on={lit}
  class:replacing
  class:stacking
  class:stack-prev={stackPrev}
  class:stack-next={stackNext}
  class:err={error}
  class:picking
  class:anchor
  class:spanned
  role="button"
  tabindex="0"
  aria-label={`${value ? 'Wert' : notes ? 'Note' : 'Stein'} ${text}`}
  onpointerenter={() => hover(true)}
  onpointerleave={() => hover(false)}
  {@attach tokenGestures(() => ({
    onTap: () => {
      if (finishWrap()) return;
      audition();
      if (editable) startEdit();
      else session.openMenu(laneId, token.id);
    },
    // Nur noch per Tastatur (Enter): Wertsteine öffnen den Wertdialog, Noten und Klänge das Feld, andere ihr Menü
    onDoubleTap: () =>
      finishWrap() ||
      (!value && editable ? startEdit() : editable ? session.openSheet(laneId, token.id) : session.openMenu(laneId, token.id)),
    immediateTap: true,
    // Noten und Klänge: langes Drücken öffnet das Menü (Entfernen, Umschliessen), weil Tippen schon bearbeitet
    onLongPress: !editable ? undefined : !value ? () => session.openMenu(laneId, token.id) : () => session.openSheet(laneId, token.id),
    onDragMove: (target) => {
      session.menu = null;
      session.wrap = null;
      session.dropHint = target;
    },
    onDrop: (target) => {
      if (target) project.move(laneId, token.id, target.laneId, target.index);
    },
  }))}
>
  <div class="stone {tone}" style:font-size={editing ? null : fontSize}>
    {#if editing}
      <input
        bind:this={input}
        type="text"
        inputmode={numeric ? 'decimal' : 'text'}
        value={draft}
        size={Math.max(draft.length, 2) + 1}
        aria-label={notes ? 'Note' : value ? 'Wert' : 'Klang'}
        aria-invalid={!valid(draft.trim())}
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        oninput={(e) => apply(e.currentTarget.value)}
        onkeydown={onKey}
        onblur={() => (editing = false)}
        {@attach (el) => {
          el.focus();
          el.select();
        }}
      />
    {:else}
      {text}
    {/if}
    {#if hasModifiers(token) && token.random !== null}<i class="mk r"></i>{/if}
    {#if hasModifiers(token) && token.repeat}<i class="mk {REPEAT_MARKS[token.repeat.op]}"></i>{/if}
    {#if hasSteps(token) && token.steps !== null}<i class="mk m"></i>{/if}
  </div>
  <!-- Menü darüber: beim Tippen auf Klang- und Klammersteine, bei Noten und Werten zusammen mit dem Eingabefeld.
       Während der Eingabe verhindert pointerdown den Fokuswechsel, sonst schliesst sich das Feld vor dem Klick. -->
  {#if menuOpen || editing}
    <div class="menu" role="menu" aria-label={`Stein ${text}`}>
      <button
        role="menuitem"
        tabindex={editing ? -1 : 0}
        aria-label={bracket ? 'Klammerpaar auflösen' : 'Entfernen'}
        title={bracket ? 'Klammerpaar auflösen' : 'Entfernen'}
        onpointerdown={(e) => editing && e.preventDefault()}
        onclick={removeIt}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5M7 7v4M9 7v4" /></svg>
      </button>
      {#if !bracket}
        <!-- Umschliessen als kleine Klammersteine: danach den Stein antippen, bis zu dem das Paar reichen soll -->
        <span class="sep" aria-hidden="true"></span>
        {#each ['[', '<', '{'] as const as g (g)}
          <button
            role="menuitem"
            tabindex={editing ? -1 : 0}
            class="wrapstone {BRACKET_TONES[g]}"
            aria-label={`Mit ${g} ${CLOSING[g]} umschliessen`}
            title={`Mit ${g} ${CLOSING[g]} umschliessen, dann den letzten Stein antippen`}
            onpointerdown={(e) => editing && e.preventDefault()}
            onclick={() => {
              input?.blur();
              session.startWrap(laneId, token.id, g);
            }}>{g}&#8239;{CLOSING[g]}</button
          >
        {/each}
      {:else}
        {#each ['[', '<', '{'] as const as g (g)}
          <button
            role="menuitemradio"
            aria-checked={bracket === g}
            class="br {BRACKET_TONES[g]}"
            aria-label={`Klammerart ${g}`}
            onclick={() => chooseGroup(g)}>{g}</button
          >
        {/each}
      {/if}
    </div>
  {/if}
  {#if editing}
    <!-- Für Touch ohne Pfeiltasten. pointerdown verhindern, damit das Feld den Fokus behält. -->
    <div class="steps">
      <button tabindex="-1" aria-label={notes ? 'Halbton tiefer' : value ? 'Kleinerer Wert' : 'Vorherige Variante'} onpointerdown={(e) => e.preventDefault()} onclick={() => step(-1)}>−</button>
      <button tabindex="-1" aria-label={notes ? 'Halbton höher' : value ? 'Grösserer Wert' : 'Nächste Variante'} onpointerdown={(e) => e.preventDefault()} onclick={() => step(1)}>+</button>
    </div>
  {/if}
</div>

<style>
  .slot {
    position: relative;
    width: var(--s);
    height: var(--s);
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;
    border-radius: 8px;
  }
  /* Roher Stein: so breit wie sein Text */
  .slot.wide {
    width: auto;
    min-width: var(--s);
  }
  .slot {
    -webkit-touch-callout: none;
  }
  /* Das Feld schwebt mittig über dem Stein, statt ihn zu verbreitern: die Reihe bleibt, wie sie ist.
     Sonst ordnen sich umgebrochene Steine neu, der Stein rutscht unter dem Finger weg und das Feld verliert gleich den Fokus. */
  input {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 13;
    width: auto;
    min-width: var(--s);
    height: var(--s);
    padding: 0 6px;
    border: none;
    border-radius: 8px;
    outline: 3px solid var(--blue);
    /* Farbe des Steins, damit die Nachbarn darunter nicht durchscheinen */
    background: inherit;
    box-shadow: inherit;
    color: inherit;
    text-align: center;
    /* Der Stein verbietet Textauswahl; ohne das lässt sich das Feld in Safari nicht bedienen */
    user-select: text;
    -webkit-user-select: text;
    /* 16px verhindert das automatische Zoomen auf iOS */
    font: 700 16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  input[aria-invalid='true'] {
    outline-color: var(--red);
  }
  /* Menü über dem Stein, mittig */
  /* Menü, ± und Eingabefeld in einer verkleinerten Reihe (Lane) oder Effektliste (EffectList) in normaler Grösse.
     Beim Feld nicht die Reihe zurücksetzen, sie spränge unter dem Finger (siehe input). In normaler Grösse zoomt iOS nicht ins Feld. */
  .menu,
  .steps,
  input {
    zoom: calc(1 / (var(--fit, 1) * var(--fx-fit, 1)));
  }
  .menu {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 25;
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--panel);
    border: 1.5px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
  }
  .menu button {
    width: 34px;
    height: 34px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-color: var(--line);
  }
  .menu svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .menu .br {
    color: #fff;
    font-size: 18px;
    border-color: transparent;
  }
  /* Klammerpaar als kleiner Stein, im Menü und unter dem Eingabefeld */
  .slot .wrapstone {
    width: auto;
    padding: 0 7px;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 15px;
    font-weight: 500;
    white-space: nowrap;
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.25);
  }
  .slot .wrapstone.br1 { background: var(--br1); }
  .slot .wrapstone.br2 { background: var(--br2); }
  .slot .wrapstone.br3 { background: var(--br3); }
  .menu .sep {
    width: 1.5px;
    margin: 4px 2px;
    background: var(--line);
  }
  .menu .br[aria-checked='true'] {
    outline: 2px solid var(--ink);
    outline-offset: 1px;
  }
  .steps {
    position: absolute;
    top: calc(100% + 4px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 12;
    display: flex;
    gap: 4px;
  }
  .steps button {
    width: 32px;
    height: 32px;
    padding: 0;
    font-size: 18px;
    line-height: 1;
    background: var(--panel);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
  }
  .slot.dragging {
    opacity: 0.35;
  }
  .slot.on .stone {
    outline: 3px solid var(--on);
    outline-offset: 1px;
  }
  .slot.replacing .stone {
    outline: 3px solid var(--blue);
    outline-offset: 1px;
    transform: scale(1.08);
  }
  .slot.stacking .stone {
    outline: 3px solid var(--green);
    outline-offset: 1px;
  }
  /* Stapel: die Steine stossen aneinander, innen eckig, eine feine Fuge dazwischen */
  .slot.stack-prev .stone {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    border-left: 1px solid var(--wood-edge);
  }
  .slot.stack-next .stone {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  /* Umschliessen: Startstein und der Bereich, den das Paar fassen würde */
  .slot.picking {
    cursor: crosshair;
  }
  .slot.spanned .stone {
    outline: 3px dashed var(--blue);
    outline-offset: 1px;
  }
  .slot.anchor .stone {
    outline: 3px solid var(--blue);
    outline-offset: 1px;
  }
  .slot.err .stone {
    outline: 3px solid var(--red);
    outline-offset: 1px;
  }
  .stone {
    width: 100%;
    height: 100%;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    position: relative;
  }
  .snd {
    background: var(--wood);
    color: var(--wood-ink);
    box-shadow: inset 0 -3px 0 var(--wood-edge);
  }
  /* Wertstein: hell wie ein Etikett, Zahl in Monospace */
  .val {
    background: var(--val);
    color: var(--val-ink);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    box-shadow: inset 0 -3px 0 var(--val-edge);
  }
  .pause {
    border: 1.5px dashed var(--line);
    color: var(--mute);
    font-weight: 500;
    font-size: 16px;
  }
  .br1,
  .br2,
  .br3 {
    color: #fff;
    font-size: 22px;
    font-weight: 500;
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.25);
  }
  .raw {
    padding: 0 7px;
    background: var(--code-bg);
    color: var(--code-ink);
    font: 600 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    white-space: nowrap;
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.35);
  }
  .br1 { background: var(--br1); }
  .br2 { background: var(--br2); }
  .br3 { background: var(--br3); }

  /* Markierungen am Stein, wenn Zufalls- oder Drehknöpfe verborgen sind: sonst unsichtbar */
  .mk {
    display: none;
  }
  /* Zufall als roter Punkt, wenn die Zufallsknöpfe verborgen sind. Nur Anzeige. */
  :global(.norandom) .mk.r {
    display: block;
    position: absolute;
    top: 2px;
    left: 50%;
    width: 7px;
    height: 7px;
    margin-left: -3.5px;
    border-radius: 50%;
    background: var(--red);
  }
  /* Wiederholung und Modulo als Balken, wenn die Drehknöpfe verborgen sind. Nur Anzeige. */
  :global(.noknobs) .mk:not(.r) {
    display: block;
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 6px;
    /* folgt den runden Ecken des Steins */
    border-radius: 0 0 8px 8px;
  }
  :global(.noknobs) .mk.b { background: var(--blue); }
  :global(.noknobs) .mk.g { background: var(--green); }
  :global(.noknobs) .mk.o { background: var(--orange); }
  /* Modulo auf der hellen Klammer weiss, damit er sich abhebt */
  :global(.noknobs) .mk.m { background: rgba(255, 255, 255, 0.85); }
</style>
