<script lang="ts">
  import { project } from '../state/project.svelte.ts';

  let copied = $state(false);

  /** Strudels Web-Editor nimmt den Code Base64-kodiert im Hash. Bei sehr langem Code geht das nicht mehr. */
  const MAX_HASH = 100_000;
  const hash = $derived(btoa(unescape(encodeURIComponent(project.codeFull))));
  const tooLong = $derived(hash.length > MAX_HASH);
  const href = $derived(tooLong ? 'https://strudel.cc/' : `https://strudel.cc/#${hash}`);

  async function copy() {
    try {
      await navigator.clipboard.writeText(project.codeFull);
      copied = true;
      setTimeout(() => (copied = false), 1400);
    } catch {
      // Zwischenablage nicht erlaubt: Code lässt sich oben markieren
    }
  }
</script>

<div class="actions">
  <a class="btn" {href} target="_blank" rel="noopener">In Strudel öffnen ↗</a>
  <button onclick={copy}>{copied ? 'Kopiert' : 'Code kopieren'}</button>
</div>
{#if tooLong}
  <p class="note">Der Code ist mit den Aufnahmen zu lang für den Link. Bitte kopieren und in Strudel einfügen.</p>
{/if}
<pre class="code" aria-live="polite">{project.codeDisplay}</pre>

<style>
  .code {
    background: var(--code-bg);
    color: var(--code-ink);
    border-radius: 10px;
    padding: 12px 14px;
    font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    overflow-x: auto;
    margin: 12px 0 0;
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
  .note {
    font-size: 13px;
    color: var(--mute);
    margin: 8px 0 0;
  }
</style>
