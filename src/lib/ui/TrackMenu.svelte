<script lang="ts">
  import { tick } from 'svelte';
  import { project } from '../state/project.svelte.ts';
  import type { Track, TrackType } from '../domain/types.ts';

  /**
   * Drei Punkte am rechten Rand des Spurkopfs: Menü mit der Art der Spur (Klang, Noten, MIDI, Sampler),
   * der Ansicht (Steine oder Code) und dem Entfernen der Spur.
   */
  let { track, index, showCode = $bindable() }: { track: Track; index: number; showCode: boolean } = $props();

  let open = $state(false);
  let root = $state<HTMLElement>();
  let trigger = $state<HTMLButtonElement>();

  const TYPES: { type: TrackType; label: string; about: string }[] = [
    { type: 'sound', label: 'Klang', about: 's("…")' },
    { type: 'note', label: 'Noten', about: 'note("…").s("…")' },
    { type: 'midi', label: 'MIDI', about: '.midi()' },
    { type: 'sampler', label: 'Sampler', about: 's("…").slice(…)' },
  ];

  $effect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root?.contains(e.target as Node)) open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      open = false;
      trigger?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  });

  async function toggle() {
    open = !open;
    if (!open) return;
    // Per Tastatur gleich im Menü weiter: der gewählte Eintrag bekommt den Fokus
    await tick();
    root?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }

  /** Pfeiltasten wandern durch die Einträge. */
  function onMenuKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(root?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  }

  function choose(action: () => void) {
    action();
    open = false;
  }
</script>

<div class="wrap" bind:this={root}>
  <button
    bind:this={trigger}
    class="dots"
    aria-label={`Menü von Spur ${index + 1}`}
    title="Art, Ansicht, Entfernen"
    aria-haspopup="menu"
    aria-expanded={open}
    onclick={toggle}
  >
    <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="13" cy="8" r="1.5" /></svg>
  </button>
  {#if open}
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div class="menu" role="menu" aria-label={`Spur ${index + 1}`} onkeydown={onMenuKey}>
      <p class="label" id={`kind-${track.id}`}>Art</p>
      <div role="group" aria-labelledby={`kind-${track.id}`}>
        {#each TYPES as t (t.type)}
          <button
            role="menuitemradio"
            aria-checked={track.type === t.type}
            onclick={() => choose(() => project.setType(track.id, t.type))}
          >
            <span class="check" aria-hidden="true">{track.type === t.type ? '✓' : ''}</span>
            {t.label}
            <code>{t.about}</code>
          </button>
        {/each}
      </div>
      <p class="label" id={`view-${track.id}`}>Ansicht</p>
      <div role="group" aria-labelledby={`view-${track.id}`}>
        <button role="menuitemradio" aria-checked={!showCode} onclick={() => choose(() => (showCode = false))}>
          <span class="check" aria-hidden="true">{showCode ? '' : '✓'}</span>
          Steine
        </button>
        <button role="menuitemradio" aria-checked={showCode} onclick={() => choose(() => (showCode = true))}>
          <span class="check" aria-hidden="true">{showCode ? '✓' : ''}</span>
          Code
        </button>
      </div>
      <hr />
      <button role="menuitem" class="remove" onclick={() => choose(() => project.removeTrack(track.id))}>
        <span class="check" aria-hidden="true"></span>
        Spur entfernen
      </button>
    </div>
  {/if}
</div>

<style>
  .wrap {
    position: relative;
  }
  .dots {
    width: 32px;
    height: 28px;
    padding: 0;
    border-color: transparent;
    color: var(--mute);
  }
  .dots:hover,
  .dots[aria-expanded='true'] {
    border-color: var(--line);
    color: var(--ink);
  }
  .dots svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
  .menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    min-width: 220px;
    background: var(--panel);
    border: 1.5px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
  }
  .menu div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .label {
    margin: 6px 8px 2px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--mute);
  }
  .label:first-child {
    margin-top: 2px;
  }
  .menu button {
    display: flex;
    align-items: baseline;
    gap: 6px;
    width: 100%;
    text-align: left;
    padding: 7px 8px;
    font-size: 14px;
    border-color: transparent;
    background: transparent;
    color: var(--ink);
  }
  .menu button:hover {
    background: color-mix(in srgb, var(--blue) 14%, transparent);
  }
  /* Ausgewählt: Häkchen und fett */
  .menu button[aria-checked='true'] {
    font-weight: 700;
  }
  .check {
    width: 1em;
    flex: none;
  }
  code {
    margin-left: auto;
    padding-left: 12px;
    font-size: 12px;
    color: var(--mute);
  }
  hr {
    width: 100%;
    margin: 4px 0;
    border: none;
    border-top: 1px solid var(--line);
  }
  .remove {
    color: var(--red) !important;
  }
</style>
