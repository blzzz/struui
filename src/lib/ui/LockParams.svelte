<script lang="ts">
  import { lockDescription, lockParams } from "../domain/locks.ts";
  import { project } from "../state/project.svelte.ts";
  import type { Track } from "../domain/types.ts";

  /**
   * Block vorne in der Reihe der Paramlocks: die Parameter übereinander, je einer auf Höhe seines Teils in den Steinen
   * (`--lock-row`). Antippen öffnet die Bearbeitung: die Auswahl ersetzt einen Parameter (die Werte bleiben), × entfernt ihn
   * samt Teil in jedem Stein, «+ Parameter» fügt einen hinten an; sein Teil ist zunächst überall leer.
   */
  let { track }: { track: Track } = $props();

  const ALL = lockParams();
  const free = $derived(ALL.filter((p) => !track.locks.params.includes(p)));

  let open = $state(false);
  let root = $state<HTMLElement>();
  let block = $state<HTMLButtonElement>();

  // Tippen ausserhalb oder Escape schliesst die Bearbeitung
  $effect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root?.contains(e.target as Node)) open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      open = false;
      block?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  });
</script>

<div class="lead" bind:this={root}>
  <button
    bind:this={block}
    class="block"
    aria-expanded={open}
    aria-label={`Parameter: ${track.locks.params.join(", ")}. Bearbeiten`}
    title={`Im Code .as("${track.locks.params.join(":")}"). Tippen: Parameter bearbeiten`}
    onclick={() => (open = !open)}
  >
    {#each track.locks.params as param (param)}
      <span class="name">{param}</span>
    {/each}
  </button>
  {#if open}
    <div class="panel" role="group" aria-label="Gesperrte Parameter">
      {#each track.locks.params as param, i (param)}
        <div class="param">
          <select
            value={param}
            aria-label={`Parameter ${i + 1}`}
            title={`${param}: ${lockDescription(param)}`}
            onchange={(e) =>
              project.renameLockParam(track.id, i, e.currentTarget.value)}
          >
            <option value={param}>{param}</option>
            {#each free as p (p)}<option value={p}>{p}</option>{/each}
          </select>
          <button
            class="x"
            disabled={track.locks.params.length <= 1}
            aria-label={`${param} entfernen`}
            title={track.locks.params.length <= 1
              ? "Der letzte Parameter bleibt"
              : `${param} entfernen, samt Wert in jedem Stein`}
            onclick={() => project.removeLockParam(track.id, i)}>×</button
          >
        </div>
      {/each}
      <select
        class="add"
        value=""
        aria-label="Parameter hinzufügen"
        title="Parameter hinten anfügen"
        onchange={(e) => {
          const name = e.currentTarget.value;
          e.currentTarget.value = "";
          if (name) project.addLockParam(track.id, name);
        }}
      >
        <option value="">+ Parameter</option>
        {#each free as p (p)}<option value={p}>{p}</option>{/each}
      </select>
    </div>
  {/if}
</div>

<style>
  /* Auf Höhe der Steine: über ihnen liegt die Zufallsreihe, wenn die Reihe sie zeigt (wie das + am Ende) */
  .lead {
    position: relative;
    flex: none;
    margin: calc(var(--s) + 2px) 6px 0 0;
  }
  :global(.norandom) .lead {
    margin-top: 0;
  }
  /* Wie ein Wertstein, aber nur umrandet: die Namen übereinander, je einer pro Zeile der Steine */
  .block {
    display: flex;
    flex-direction: column;
    min-width: var(--s);
    min-height: 0;
    height: var(--sh, var(--s));
    padding: var(--lock-pad, 3px) 6px;
    border: 1.5px solid var(--val-edge);
    border-radius: 8px;
    background: transparent;
    color: inherit;
    font:
      600 11px ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
  }
  .block[aria-expanded="true"] {
    outline: 3px solid var(--blue);
    outline-offset: 1px;
  }
  .name {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-height: 0;
    white-space: nowrap;
  }
  .name + .name {
    border-top: 1px solid var(--val-edge);
  }
  /* Bearbeitung schwebt unter dem Block, die Reihe bleibt, wie sie ist */
  .panel {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    background: var(--panel);
    border: 1.5px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
  }
  .param {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  select {
    flex: 1;
    /* 16px verhindert das automatische Zoomen auf iOS */
    font:
      600 16px ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
  }
  .add {
    color: var(--mute);
    font-weight: 500;
  }
  .x {
    width: 32px;
    padding: 0;
    color: var(--mute);
    font-size: 18px;
    line-height: 1;
  }
  .x:hover:not(:disabled) {
    color: var(--red);
  }
  .x:disabled {
    opacity: 0.3;
  }
</style>
