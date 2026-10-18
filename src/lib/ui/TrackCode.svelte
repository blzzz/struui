<script lang="ts">
  import { trackToCode } from '../domain/codegen.ts';
  import { project } from '../state/project.svelte.ts';
  import { codeToTrack } from '../syntax/from-code.ts';
  import type { Track } from '../domain/types.ts';

  /**
   * Die ganze Codezeile einer Spur zum Lesen und Bearbeiten: Name, Klänge und Effekte (`/* drums *\/ s("bd sd").lpf(800)`).
   * Jeder gültige Tastendruck ändert sofort Steine, Effekte und Namen. Solange der Text ungültig ist,
   * bleibt alles beim letzten gültigen Stand. Beim Verlassen des Felds steht wieder der erzeugte Code da.
   */
  let { track }: { track: Track } = $props();

  let focused = $state(false);
  let draft = $state('');
  let error = $state<{ offset: number; message: string } | null>(null);

  // Effekte mit Fehler stehen auch hier, damit sie beim Bearbeiten nicht verschwinden
  const generated = $derived(trackToCode(track).text);

  function onInput(e: Event) {
    draft = (e.currentTarget as HTMLTextAreaElement).value;
    const result = codeToTrack(draft, track.type);
    if (result.ok) {
      error = null;
      project.applyCode(track.id, result);
    } else {
      error = { offset: result.offset, message: result.message };
    }
  }

  function onFocus() {
    draft = generated;
    focused = true;
  }

  function onBlur() {
    focused = false;
    error = null;
  }
</script>

<textarea
  class="code"
  class:err={error}
  value={focused ? draft : generated}
  rows="2"
  aria-label="Code der Spur"
  aria-invalid={error !== null}
  spellcheck="false"
  autocomplete="off"
  autocapitalize="off"
  oninput={onInput}
  onfocus={onFocus}
  onblur={onBlur}
  onkeydown={(e) => {
    // Eine Spur ist eine Zeile: Enter beendet die Eingabe
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }}
></textarea>
{#if error}
  <p class="error">
    Das versteht Strudel-Steine nicht (ab Zeichen {error.offset + 1}). Es bleibt beim letzten gültigen Stand.
    <small>{error.message}</small>
  </p>
{/if}

<style>
  .code {
    display: block;
    width: 100%;
    margin-top: 4px;
    padding: 8px 10px;
    background: var(--code-bg);
    color: var(--code-ink);
    border-radius: 8px;
    border: 1.5px solid transparent;
    resize: vertical;
    /* 16px verhindert das automatische Zoomen auf iOS */
    font: 16px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    field-sizing: content;
    min-height: 2lh;
  }
  .code:focus {
    outline: none;
    border-color: var(--blue);
  }
  .code.err {
    border-color: var(--red);
  }
  .error {
    color: var(--red);
    font-size: 13px;
    margin: 6px 0 0;
  }
  .error small {
    display: block;
    color: var(--mute);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    margin-top: 2px;
  }
</style>
