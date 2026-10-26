<script lang="ts">
  import { patterns } from '../state/patterns.svelte.ts';
  import { session } from '../state/session.svelte.ts';

  /** Alle gespeicherten Patterns, zuletzt gespeichertes zuerst: laden oder löschen. */
  let dialog = $state<HTMLDialogElement>();

  $effect(() => {
    if (!dialog) return;
    if (session.patterns && !dialog.open) dialog.showModal();
    else if (!session.patterns && dialog.open) dialog.close();
  });

  const close = () => (session.patterns = false);

  const when = new Intl.DateTimeFormat('de-CH', { dateStyle: 'short', timeStyle: 'short' });

  function load(id: string) {
    patterns.load(id);
    close();
  }

  function remove(id: string, name: string) {
    if (confirm(`«${name}» löschen? Das lässt sich nicht rückgängig machen.`)) patterns.remove(id);
  }
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="patterns-title"
  onclose={close}
  onclick={(e) => {
    if (e.target === dialog) close();
  }}
>
  <div class="box">
    <h2 id="patterns-title">Pattern laden</h2>
    <p class="sub">Gespeichert in diesem Browser. Gespeichert wird der Code der gewählten Szene.</p>
    <ul>
      {#each patterns.list as p (p.id)}
        {@const current = p.id === patterns.current?.id}
        <li class:current>
          <button class="load" onclick={() => load(p.id)} aria-current={current}>
            <span class="name">{p.name}</span>
            <span class="date">{current ? 'offen' : when.format(p.updated)}</span>
          </button>
          <button class="remove" aria-label={`${p.name} löschen`} title="Löschen" onclick={() => remove(p.id, p.name)}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5" /></svg>
          </button>
        </li>
      {/each}
    </ul>
    <button class="wide" onclick={close}>Schliessen</button>
  </div>
</dialog>

<style>
  dialog {
    width: min(460px, calc(100% - 32px));
    max-height: 85%;
    padding: 0;
    border: none;
    border-radius: 14px;
    background: var(--panel);
    color: var(--ink);
  }
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.45);
  }
  .box {
    padding: 18px 18px 16px;
  }
  h2 {
    font-size: 18px;
    margin: 0 0 2px;
  }
  .sub {
    color: var(--mute);
    font-size: 14px;
    margin: 0 0 14px;
  }
  ul {
    list-style: none;
    margin: 0 0 16px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  li {
    display: flex;
    gap: 4px;
  }
  .load {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 8px 10px;
    text-align: left;
  }
  .current .load {
    border-color: var(--on);
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  .date {
    flex: none;
    font-size: 13px;
    color: var(--mute);
    font-variant-numeric: tabular-nums;
  }
  .remove {
    flex: none;
    width: 40px;
    padding: 0;
    display: grid;
    place-items: center;
    color: var(--mute);
  }
  .remove:hover {
    color: var(--red);
    border-color: var(--red);
  }
  .remove svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .wide {
    width: 100%;
  }
</style>
