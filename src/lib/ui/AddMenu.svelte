<script lang="ts">
  import { PAUSE } from "../domain/types.ts";
  import { project } from "../state/project.svelte.ts";
  import { session } from "../state/session.svelte.ts";
  import type { GroupType } from "../domain/types.ts";

  /** Das + am Ende einer Effektreihe: Wert (öffnet den Wertdialog) oder Klammerpaar. Klangreihen füllt die Palette. */
  let { laneId }: { laneId: string } = $props();

  let open = $state(false);
  /** Menü nach links ausrichten, wenn das + in der rechten Hälfte liegt. */
  let alignRight = $state(false);
  let root = $state<HTMLElement>();

  $effect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root?.contains(e.target as Node)) open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") open = false;
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  });

  function toggle(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    alignRight = rect.left > window.innerWidth / 2;
    open = !open;
  }

  function valueSheet() {
    open = false;
    session.openSheet(laneId, null);
  }

  function pair(group: GroupType) {
    open = false;
    project.placePair(laneId, null, "insert", group);
  }
</script>

<div class="wrap" bind:this={root}>
  <button
    class="plus"
    aria-label="Wert anhängen"
    aria-haspopup="menu"
    aria-expanded={open}
    onclick={toggle}>+</button
  >
  {#if open}
    <div class="menu" class:right={alignRight} role="menu">
      <button role="menuitem" class="val" onclick={valueSheet}>Wert …</button>
      <button role="menuitem" class="br1" onclick={() => pair("[")}
        >[ ] Gruppe</button
      >
      <button role="menuitem" class="br2" onclick={() => pair("<")}
        >&lt; &gt; Wechsel</button
      >
      <button role="menuitem" class="br3" onclick={() => pair("{")}
        >{"{ }"} Polymeter</button
      >
    </div>
  {/if}
</div>

<style>
  .wrap {
    position: relative;
  }
  .plus {
    width: var(--s);
    height: var(--s);
    padding: 0;
    border: 1.5px dashed var(--mute);
    color: var(--mute);
    border-radius: 8px;
    font-size: 22px;
    line-height: 1;
  }
  .menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px;
    min-width: 150px;
    background: var(--panel);
    border: 1.5px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
  }
  .menu.right {
    left: auto;
    right: 0;
  }
  .menu button {
    text-align: left;
    padding: 9px 10px;
    font-size: 14px;
    font-weight: 700;
  }
  .val {
    background: var(--val);
    color: var(--val-ink);
    border-color: var(--val-edge);
  }
  .br1,
  .br2,
  .br3 {
    color: #fff;
  }
  .br1 {
    background: var(--br1);
    border-color: var(--br1);
  }
  .br2 {
    background: var(--br2);
    border-color: var(--br2);
  }
  .br3 {
    background: var(--br3);
    border-color: var(--br3);
  }
</style>
