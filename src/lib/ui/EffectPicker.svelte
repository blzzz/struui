<script lang="ts">
  import { tick } from 'svelte';
  import { EFFECT_CATEGORIES, browseEffects, categoryOf, searchNoteOps } from '../domain/effects.ts';
  import type { EffectCategory, EffectInfo } from '../domain/effects.ts';
  import { browseLockParams } from '../domain/locks.ts';
  import { project } from '../state/project.svelte.ts';
  import { session } from '../state/session.svelte.ts';
  import { CATEGORY_LABELS } from './messages.ts';

  /**
   * Effekt hinzufügen (Plus am Ende der Effekte, `EffectList`): Suchfeld, darunter Filter nach Art (nur Arten, die es für
   * die Spur gibt, einzeilig waagrecht scrollbar, beim Öffnen immer «Alle»), darunter alle Treffer mit Beschreibung. Pfeile und
   * Enter im Suchfeld, Tippen auf einen Treffer fügt ihn an. Für die Rechenarten einer Notenspur ohne Filter (es sind nur vier).
   * Für die Paramlocks (`LockParams`) die sperrbaren Parameter ohne die schon gesperrten: fügt einen an oder ersetzt einen.
   */
  let dialog = $state<HTMLDialogElement>();
  let input = $state<HTMLInputElement>();
  let list = $state<HTMLElement>();
  let chips = $state<HTMLElement>();

  let query = $state('');
  let category = $state<EffectCategory | null>(null);
  let active = $state(0);

  const target = $derived(session.effectPicker);
  const track = $derived(target ? project.tracks.find((t) => t.id === target.trackId) : undefined);
  const ops = $derived(target?.kind === 'noteOps');
  const lock = $derived(target?.kind === 'locks' ? target : null);
  /** Relative Notenspur: hat ihre Tonleiter schon, `scale` fehlt in der Auswahl. */
  const relative = $derived(track?.type === 'note' && track.pitch === 'relative');

  /** Arten mit mindestens einem Effekt für diese Spur, in fester Reihenfolge. */
  const categories = $derived.by(() => {
    if (!track || ops) return [];
    const all = lock ? browseLockParams('', null, track.locks.params) : browseEffects('', track.type, null, relative);
    const offered = new Set(all.map(categoryOf));
    return EFFECT_CATEGORIES.filter((c) => offered.has(c));
  });

  const options = $derived(
    !track
      ? []
      : ops
        ? searchNoteOps(query, Infinity)
        : lock
          ? browseLockParams(query, category, track.locks.params)
          : browseEffects(query, track.type, category, relative),
  );

  $effect(() => {
    if (!dialog) return;
    if (target && !dialog.open) {
      query = '';
      active = 0;
      category = null;
      dialog.showModal();
      chips?.scrollTo({ left: 0 });
      input?.focus();
    } else if (!target && dialog.open) dialog.close();
  });

  const close = () => (session.effectPicker = null);

  function pick(info: EffectInfo) {
    if (target?.kind === 'locks') {
      if (target.index === null) project.addLockParam(target.trackId, info.name);
      else project.renameLockParam(target.trackId, target.index, info.name);
    } else if (target) project.addEffect(target.trackId, info.name, target.kind);
    close();
  }

  function filter(e: MouseEvent, c: EffectCategory | null) {
    category = c;
    (e.currentTarget as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest' });
    active = 0;
    list?.scrollTo({ top: 0 });
  }

  async function move(to: number) {
    active = Math.max(0, Math.min(to, options.length - 1));
    await tick();
    list?.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(active - 1);
    } else if (e.key === 'Enter' && options[active]) {
      e.preventDefault();
      pick(options[active]);
    }
  }
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="picker-title"
  onclose={close}
  onclick={(e) => {
    if (e.target === dialog) close();
  }}
>
  <div class="box">
    <div class="top">
      <h2 id="picker-title">
        {ops
          ? 'Mit Noten rechnen'
          : lock
            ? lock.index === null
              ? 'Parameter sperren'
              : `${track?.locks.params[lock.index] ?? 'Parameter'} ersetzen`
            : 'Effekt hinzufügen'}
      </h2>
      <button class="close" aria-label="Schliessen" onclick={close}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
      </button>
    </div>
    <input
      bind:this={input}
      type="search"
      placeholder={ops ? 'add, div …' : lock ? 'Suchen: n, gain, lpf …' : 'Suchen: lpf, room, fast …'}
      aria-label="Suchen"
      aria-controls="picker-list"
      aria-activedescendant={options[active] ? `picker-${active}` : undefined}
      spellcheck="false"
      autocomplete="off"
      autocapitalize="off"
      bind:value={query}
      oninput={() => (active = 0)}
      onkeydown={onKeydown}
    />
    {#if categories.length > 1}
      <div class="chips" role="group" aria-label="Art" bind:this={chips}>
        <button class="chip" aria-pressed={category === null} onclick={(e) => filter(e, null)}>Alle</button>
        {#each categories as c (c)}
          <button class="chip" aria-pressed={category === c} onclick={(e) => filter(e, category === c ? null : c)}>
            {CATEGORY_LABELS[c]}
          </button>
        {/each}
      </div>
    {/if}
    <ul id="picker-list" role="listbox" aria-label={ops ? 'Rechenarten' : lock ? 'Parameter' : 'Effekte'} bind:this={list}>
      {#each options as info, i (info.name)}
        <!-- Tastatur bedient das Suchfeld (Pfeile, Enter), die Treffer bekommen keinen Fokus -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li
          id={`picker-${i}`}
          role="option"
          aria-selected={i === active}
          class:active={i === active}
          onpointerenter={() => (active = i)}
          onclick={() => pick(info)}
        >
          <span class="name">{info.name}</span>
          {#if !ops && category === null}<span class="cat">{CATEGORY_LABELS[categoryOf(info)]}</span>{/if}
          {#if info.synonyms.length > 0}<span class="syn">{info.synonyms.join(', ')}</span>{/if}
          <span class="desc">{info.description}</span>
        </li>
      {:else}
        <li class="none">Nichts gefunden.</li>
      {/each}
    </ul>
  </div>
</dialog>

<style>
  dialog {
    width: min(560px, calc(100% - 24px));
    height: min(640px, 85%);
    padding: 0;
    border: none;
    border-radius: 14px;
    background: var(--fx-dialog);
    color: var(--ink);
  }
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.45);
  }
  .box {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 14px 8px;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h2 {
    font-size: 18px;
    margin: 0;
  }
  .close {
    width: 36px;
    height: 36px;
    padding: 0;
    display: grid;
    place-items: center;
    border: none;
    color: var(--mute);
  }
  .close:hover {
    color: var(--ink);
  }
  .close svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
  }
  input {
    width: 100%;
    padding: 8px 10px;
    border: 1.5px solid var(--fx-line);
    border-radius: 8px;
    background: var(--fx);
    color: var(--ink);
    /* 16px verhindert das automatische Zoomen auf iOS */
    font:
      16px ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
  }
  input:focus {
    outline: none;
    border-color: var(--blue);
  }
  /* Eine Zeile, waagrecht scrollbar bis an den Rand des Dialogs (wie die Klangpalette) */
  .chips {
    flex: none;
    display: flex;
    gap: 6px;
    margin: 0 -14px;
    padding: 0 14px 4px;
    scroll-padding-inline: 14px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
  }
  .chip {
    flex: none;
    white-space: nowrap;
    padding: 4px 10px;
    font-size: 13px;
    border-color: var(--fx-line);
    border-radius: 999px;
    color: var(--fx-mute);
  }
  .chip:hover {
    color: var(--ink);
  }
  .chip[aria-pressed='true'] {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--bg);
  }
  ul {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    margin: 0 -6px;
    padding: 0 6px;
    list-style: none;
  }
  li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 8px;
    padding: 7px 8px;
    border-radius: 6px;
    cursor: pointer;
  }
  li.active {
    background: color-mix(in srgb, var(--blue) 18%, transparent);
  }
  li.none {
    color: var(--mute);
    cursor: default;
  }
  .name {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-weight: 600;
  }
  .cat {
    font-size: 11px;
    padding: 0 6px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--ink) 10%, transparent);
    color: var(--mute);
  }
  .syn {
    color: var(--mute);
    font-size: 12px;
  }
  .desc {
    flex-basis: 100%;
    color: var(--mute);
    font-size: 12px;
  }
</style>
