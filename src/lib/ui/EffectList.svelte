<script lang="ts">
  import { searchEffects, searchNoteOps, valueInfo } from '../domain/effects.ts';
  import type { EffectInfo } from '../domain/effects.ts';
  import { project } from '../state/project.svelte.ts';
  import type { RowKind } from '../state/project.svelte.ts';
  import { session } from '../state/session.svelte.ts';
  import Lane from './Lane.svelte';
  import { PARSE_MESSAGES } from './messages.ts';
  import type { Track } from '../domain/types.ts';

  /**
   * Effekte einer Spur: eine Zeile pro Effekt mit seinen Wertsteinen, darunter ein Suchfeld zum Hinzufügen.
   * Wertsteine verhalten sich wie Klangsteine (Tippen, Doppeltippen, Ziehen, Klammern, Zufall, Wiederholung).
   * `kind = 'noteOps'`: dieselbe Liste für die Rechenarten einer Notenspur (`add`, `div` …), direkt nach den Noten.
   * `readonly` (eingeklappte Spur): Effekte folgen ohne eigene Zeile aufeinander, nur Name und Wertsteine.
   * Kein Suchfeld, kein Entfernen, nichts lässt sich bearbeiten. Effekte ohne Wert fehlen, fehlerhafte sind rot markiert.
   */
  let { track, kind = 'effects', readonly = false }: { track: Track; kind?: RowKind; readonly?: boolean } = $props();
  const ops = $derived(kind === 'noteOps');

  let query = $state('');
  let open = $state(false);
  let active = $state(0);

  const listId = $derived(`${kind}-list-${track.id}`);
  const options = $derived(ops ? searchNoteOps(query) : searchEffects(query, track.type));
  const placeholder = $derived(ops ? 'Mit Noten rechnen (add, div …)' : 'Effekt hinzufügen …');

  function pick(info: EffectInfo) {
    const added = project.addEffect(track.id, info.name, kind);
    query = '';
    open = false;
    active = 0;
    // Zeigt Strudel keine Beispielwerte, gleich nach einem Wert fragen
    if (added?.empty) session.openSheet(added.id, null);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      open = true;
      active = Math.min(active + 1, options.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(active - 1, 0);
    } else if (e.key === 'Enter') {
      if (open && options[active]) {
        e.preventDefault();
        pick(options[active]);
      }
    } else if (e.key === 'Escape') {
      if (open) open = false;
      else query = '';
    }
  }

  const messages = (effectId: string) => [...new Set(project.parsedOf(effectId).errors.map((e) => PARSE_MESSAGES[e.code]))];
</script>

<div class="effects" class:readonly>
  {#each track[kind] as fx (fx.id)}
    {@const info = valueInfo(fx.name)}
    {@const errors = messages(fx.id)}
    {#if readonly}
      {#if fx.tokens.length > 0}
        <div class="fx" class:bad={errors.length > 0} title={errors.length > 0 ? `${errors.join(' ')} Dieser Effekt ist aus.` : info?.description}>
          <span class="name">.{fx.name}</span>
          <Lane laneId={fx.id} tokens={fx.tokens} value readonly />
        </div>
      {/if}
    {:else}
      <div class="fx" class:off={fx.tokens.length === 0} data-effect-id={fx.id}>
        <div class="head">
          <span class="name">.{fx.name}</span>
          <span class="desc" title={info?.hint}>{info?.description ?? ''}</span>
          <button class="remove" aria-label={`${fx.name} entfernen`} onclick={() => project.removeEffect(track.id, fx.id, kind)}>×</button>
        </div>
        <Lane laneId={fx.id} tokens={fx.tokens} value />
        {#if errors.length > 0}
          <p class="error">{errors.join(' ')} Dieser Effekt ist aus.</p>
        {:else if fx.tokens.length === 0}
          <p class="note">Ohne Wert ist der Effekt aus.</p>
        {/if}
      </div>
    {/if}
  {/each}

  {#if !readonly}
    <div class="search">
      <input
        type="text"
        role="combobox"
        {placeholder}
        aria-label={placeholder}
        aria-autocomplete="list"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        bind:value={query}
        oninput={() => {
          open = true;
          active = 0;
        }}
        onfocus={() => (open = true)}
        onblur={() => (open = false)}
        onkeydown={onKeydown}
      />
      {#if open && options.length > 0}
        <ul id={listId} role="listbox" aria-label={ops ? 'Rechenarten' : 'Effekte'}>
          {#each options as info, i (info.name)}
            <!-- Tastatur bedient das Suchfeld (Pfeile, Enter), die Optionen bekommen keinen Fokus -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <li
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              class:active={i === active}
              onpointerdown={(e) => e.preventDefault()}
              onpointerenter={() => (active = i)}
              onclick={() => pick(info)}
            >
              <span class="opt-name">{info.name}</span>
              {#if info.synonyms.length > 0}<span class="syn">{info.synonyms.join(', ')}</span>{/if}
              <span class="opt-desc">{info.description}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

<style>
  .effects {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
  }
  /* Eine Effektzeile: Name, Beschreibung, ×, darunter die Wertsteine. Links ein Strich hält beides zusammen. */
  .fx {
    padding-left: 10px;
    border-left: 3px solid var(--val-edge);
  }
  /* Eingeklappt: keine eigene Zeile, die Effekte reihen sich in den Fluss der Spur ein (siehe `.main.compact` in TrackView) */
  .effects.readonly {
    display: contents;
  }
  .readonly .fx {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-left: 6px;
  }
  .readonly .name {
    font-size: 13px;
  }
  .readonly .fx.bad .name {
    color: var(--red);
    text-decoration: line-through;
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 2px;
    font-size: 14px;
  }
  .name {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-weight: 600;
  }
  .fx.off .name {
    color: var(--mute);
  }
  .desc {
    flex: 1;
    min-width: 0;
    color: var(--mute);
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .remove {
    padding: 0 8px;
    font-size: 18px;
    line-height: 1.4;
    border-color: transparent;
    color: var(--mute);
  }
  .error,
  .note {
    font-size: 13px;
    margin: 4px 0 0;
  }
  .error {
    color: var(--red);
  }
  .note {
    color: var(--mute);
  }
  input {
    width: 100%;
    min-width: 0;
    padding: 5px 8px;
    border: 1.5px solid var(--line);
    border-radius: 6px;
    background: transparent;
    color: var(--ink);
    /* 16px verhindert das automatische Zoomen auf iOS */
    font: 16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  input:focus {
    outline: none;
    border-color: var(--blue);
  }
  .search {
    position: relative;
    max-width: 420px;
  }
  .search input {
    border-style: dashed;
  }
  ul {
    position: absolute;
    z-index: 15;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    max-height: 320px;
    overflow-y: auto;
    margin: 0;
    padding: 4px;
    list-style: none;
    background: var(--panel);
    border: 1.5px solid var(--line);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  }
  li {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
  }
  li.active {
    background: color-mix(in srgb, var(--blue) 18%, transparent);
  }
  .opt-name {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-weight: 600;
  }
  .syn {
    color: var(--mute);
    font-size: 12px;
    align-self: center;
  }
  .opt-desc {
    grid-column: 1 / -1;
    color: var(--mute);
    font-size: 12px;
  }
</style>
