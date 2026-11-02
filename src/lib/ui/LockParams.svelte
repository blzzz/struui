<script lang="ts">
  import { lockDescription } from "../domain/locks.ts";
  import { project } from "../state/project.svelte.ts";
  import { session } from "../state/session.svelte.ts";
  import type { Track } from "../domain/types.ts";

  /**
   * Block vorne in der Reihe der Paramlocks: die Parameter übereinander, je einer auf Höhe seines Teils in den Steinen
   * (`--lock-row`). Antippen öffnet die Bearbeitung: ein Parameter öffnet die Effektsuche (`EffectPicker`) und wird ersetzt
   * (die Werte bleiben), × entfernt ihn samt Teil in jedem Stein (der letzte nimmt alle Steine mit), «+ Parameter» fügt einen hinten an; sein Teil ist zunächst
   * überall leer.
   */
  let { track }: { track: Track } = $props();

  const choose = (index: number | null) =>
    (session.effectPicker = { trackId: track.id, kind: "locks", index });

  let open = $state(false);
  let root = $state<HTMLElement>();
  let block = $state<HTMLButtonElement>();

  // Tippen ausserhalb oder Escape schliesst die Bearbeitung, nicht aber im Dialog der Effektsuche
  $effect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (session.effectPicker) return;
      if (!root?.contains(e.target as Node)) open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || session.effectPicker) return;
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
          <button
            class="pick"
            aria-haspopup="dialog"
            aria-label={`Parameter ${i + 1}: ${param}. Ersetzen`}
            title={`${param}: ${lockDescription(param)}. Tippen: ersetzen`}
            onclick={() => choose(i)}>{param}</button
          >
          <button
            class="x"
            aria-label={`${param} entfernen`}
            title={track.locks.params.length <= 1
              ? `${param} entfernen: die Paramlocks gehen samt allen Steinen weg`
              : `${param} entfernen, samt Wert in jedem Stein`}
            onclick={() => project.removeLockParam(track.id, i)}>×</button
          >
        </div>
      {/each}
      <button
        class="pick add"
        aria-haspopup="dialog"
        title="Parameter hinten anfügen"
        onclick={() => choose(null)}>+ Parameter</button
      >
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
    min-width: 160px;
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
  .pick {
    flex: 1;
    text-align: left;
    font:
      600 14px ui-monospace,
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
