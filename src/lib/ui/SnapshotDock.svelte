<script lang="ts">
  import { tick } from 'svelte';
  import { project } from '../state/project.svelte.ts';
  import { snapshots } from '../state/snapshots.svelte.ts';

  let row = $state<HTMLElement>();

  /** Festhalten, ans Ende scrollen und den Namen gleich zum Überschreiben markieren. */
  async function take() {
    const id = snapshots.take();
    if (!id) return;
    await tick();
    const input = row?.querySelector<HTMLInputElement>(`[data-snap="${id}"] input`);
    input?.scrollIntoView({ inline: 'end', block: 'nearest' });
    input?.focus();
    input?.select();
  }

  const playing = (tracks: { tokens: unknown[]; muted: boolean }[]) =>
    tracks.filter((t) => t.tokens.length > 0 && !t.muted).length;
</script>

<!-- Feste Leiste unten: Snapshots des ganzen Codes -->
<footer class="dock">
  <button
    class="take"
    disabled={!project.valid}
    title={project.valid ? 'Aktuellen Code festhalten' : 'Nur gültiger Code lässt sich festhalten'}
    onclick={take}
  >
    <span class="plus" aria-hidden="true">+</span>
    Snapshot
  </button>

  <div class="row" bind:this={row} role="list" aria-label="Snapshots">
    {#each snapshots.list as s (s.id)}
      {@const n = playing(s.tracks)}
      <div class="snap" class:on={snapshots.current?.id === s.id} data-snap={s.id} role="listitem">
        <input
          class="name"
          value={s.name}
          aria-label="Name des Snapshots"
          enterkeyhint="done"
          onchange={(e) => snapshots.rename(s.id, e.currentTarget.value)}
          onblur={(e) => (e.currentTarget.value = s.name)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              if (e.key === 'Escape') e.currentTarget.value = s.name;
              e.currentTarget.blur();
            }
          }}
        />
        <button class="face" title="Diesen Zustand laden" onclick={() => snapshots.load(s.id)}>
          {n} {n === 1 ? 'Spur' : 'Spuren'} · {(1 / s.cps).toFixed(1)} s
        </button>
        <button class="x" aria-label={`${s.name} entfernen`} title="Entfernen" onclick={() => snapshots.remove(s.id)}>
          ×
        </button>
      </div>
    {:else}
      <p class="empty">Hält den ganzen Code fest. Antippen lädt ihn wieder.</p>
    {/each}
  </div>
</footer>

<style>
  .dock {
    position: fixed;
    inset: auto 0 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 10px;
    height: calc(var(--dock-h) + env(safe-area-inset-bottom, 0px));
    padding: 0 max(12px, env(safe-area-inset-right, 0px)) env(safe-area-inset-bottom, 0px)
      max(12px, env(safe-area-inset-left, 0px));
    background: var(--panel);
    border-top: 1.5px solid var(--line);
  }
  .take {
    flex: none;
    height: 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 0 12px;
    border-style: dashed;
    font-size: 13px;
  }
  .take:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .plus {
    font-size: 22px;
    line-height: 1;
  }
  .row {
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    /* Platz für Umrandung und Schatten */
    padding: 0 4px;
  }
  .empty {
    margin: 0;
    font-size: 13px;
    color: var(--mute);
  }
  /* Grösserer Stein: Holz wie ein Klangstein, oben der Name, darunter die Fläche zum Laden */
  .snap {
    flex: none;
    position: relative;
    width: 132px;
    height: 64px;
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    background: var(--wood);
    color: var(--wood-ink);
    box-shadow: inset 0 -4px 0 var(--wood-edge);
  }
  .snap.on {
    outline: 3px solid var(--on);
    outline-offset: 1px;
  }
  .name {
    width: 100%;
    min-width: 0;
    padding: 8px 24px 2px 10px;
    border: none;
    background: transparent;
    color: inherit;
    font: 700 14px system-ui, -apple-system, 'Segoe UI', sans-serif;
    border-radius: 10px 10px 0 0;
    text-overflow: ellipsis;
  }
  .name:focus {
    outline: none;
    background: color-mix(in srgb, #fff 45%, transparent);
  }
  .face {
    flex: 1;
    width: 100%;
    padding: 0 10px 6px;
    border: none;
    border-radius: 0 0 10px 10px;
    background: transparent;
    color: inherit;
    font-size: 12px;
    font-weight: 500;
    text-align: left;
    opacity: 0.8;
  }
  .x {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: inherit;
    font-size: 16px;
    line-height: 1;
    opacity: 0.6;
  }
  .x:hover {
    opacity: 1;
  }
</style>
