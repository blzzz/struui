<script lang="ts">
  import { arrangement } from '../state/arrangement.svelte.ts';
  import { board } from '../state/board.svelte.ts';
  import { project } from '../state/project.svelte.ts';
  import { programToTracks } from '../syntax/from-program.ts';

  let copied = $state(false);
  /** Bearbeiteter, noch nicht übernommener Code. null = es steht der erzeugte Code da. */
  let draft = $state<string | null>(null);
  let error = $state<{ line: number; column: number; message: string } | null>(null);

  /** Strudels Web-Editor nimmt den Code Base64-kodiert im Hash. Bei sehr langem Code geht das nicht mehr. */
  const MAX_HASH = 100_000;
  const hash = $derived(btoa(unescape(encodeURIComponent(arrangement.codeFull))));
  const tooLong = $derived(hash.length > MAX_HASH);
  const href = $derived(tooLong ? 'https://strudel.cc/' : `https://strudel.cc/#${hash}`);

  async function copy() {
    try {
      await navigator.clipboard.writeText(arrangement.codeFull);
      copied = true;
      setTimeout(() => (copied = false), 1400);
    } catch {
      // Zwischenablage nicht erlaubt: Code lässt sich oben markieren
    }
  }

  /**
   * Den bearbeiteten Code übernehmen (Verlassen des Felds, Strg/⌘+Enter, Knopf). Was Strudel-Steine versteht, wird zu
   * Spuren, der Rest bleibt wörtlich stehen. Nur ungültiges JavaScript wird abgelehnt, dann bleibt der Entwurf mit Fehlerstelle.
   */
  function apply() {
    if (draft === null) return;
    // Eine Sampler-Spur bleibt eine, auch wenn ihre Zeile (`.scrub(…)`) wie ein Effekt aussieht
    const r = programToTracks(draft, (name) => project.tracks.find((t) => t.name === name)?.type);
    if (!r.ok) {
      const lines = draft.slice(0, r.offset).split('\n');
      error = { line: lines.length, column: lines[lines.length - 1].length + 1, message: r.message };
      return;
    }
    project.applyProgram(r);
    if (r.board) board.place(r.board);
    draft = null;
    error = null;
  }

  function discard() {
    draft = null;
    error = null;
  }
</script>

<div class="actions">
  <a class="btn" {href} target="_blank" rel="noopener">In Strudel öffnen ↗</a>
  <button onclick={copy}>{copied ? 'Kopiert' : 'Code kopieren'}</button>
  {#if draft !== null}
    <!-- pointerdown ohne Fokuswechsel: sonst übernähme das Verlassen des Felds den Entwurf vor dem Verwerfen -->
    <button class="primary" onpointerdown={(e) => e.preventDefault()} onclick={apply}>Übernehmen</button>
    <button onpointerdown={(e) => e.preventDefault()} onclick={discard}>Verwerfen</button>
  {/if}
</div>
{#if tooLong}
  <p class="note">Der Code ist mit den Aufnahmen zu lang für den Link. Bitte kopieren und in Strudel einfügen.</p>
{/if}
{#if arrangement.active}
  <p class="note">Im Arrangement lässt sich der Code nur lesen. Zum Bearbeiten das Arrangement ausschalten.</p>
  <pre class="code" aria-live="polite">{arrangement.codeDisplay}</pre>
{:else}
  <textarea
    class="code"
    class:err={error}
    value={draft ?? arrangement.codeDisplay}
    aria-label="Code des ganzen Projekts"
    aria-invalid={error !== null}
    spellcheck="false"
    autocomplete="off"
    autocapitalize="off"
    wrap="off"
    oninput={(e) => {
      draft = e.currentTarget.value;
      error = null;
    }}
    onblur={apply}
    onkeydown={(e) => {
      // Wie in Strudel: Strg/⌘+Enter wertet aus
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        apply();
      }
    }}
  ></textarea>
  {#if error}
    <p class="error">
      Zeile {error.line}, Zeichen {error.column}: {error.message} Es bleibt beim letzten gültigen Stand.
    </p>
  {:else}
    <p class="note">
      Übernehmen mit Strg/⌘+Enter oder beim Verlassen des Felds. Was Strudel-Steine nicht als Spur versteht, bleibt als Code
      stehen.
    </p>
  {/if}
{/if}

<style>
  .code {
    display: block;
    width: 100%;
    background: var(--code-bg);
    color: var(--code-ink);
    border-radius: 10px;
    border: 1.5px solid transparent;
    padding: 12px 14px;
    font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    overflow-x: auto;
    margin: 12px 0 0;
  }
  textarea.code {
    resize: vertical;
    /* 16px verhindert das automatische Zoomen auf iOS */
    font-size: 16px;
    field-sizing: content;
    min-height: 12lh;
  }
  textarea.code:focus {
    outline: none;
    border-color: var(--blue);
  }
  textarea.code.err {
    border-color: var(--red);
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .btn {
    font-weight: 500;
    font-size: 15px;
    border: 1.5px solid var(--ink);
    color: var(--ink);
    border-radius: 8px;
    padding: 8px 14px;
    text-decoration: none;
  }
  .primary {
    border-color: var(--blue);
    color: var(--blue);
  }
  .note {
    font-size: 13px;
    color: var(--mute);
    margin: 8px 0 0;
  }
  .error {
    color: var(--red);
    font-size: 13px;
    margin: 8px 0 0;
  }
</style>
