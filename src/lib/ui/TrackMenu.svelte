<script lang="ts">
  import { tick } from 'svelte';
  import { project } from '../state/project.svelte.ts';
  import { CHANNEL_MAX, ORBIT_MAX } from '../domain/types.ts';
  import type { Track, TrackType } from '../domain/types.ts';

  /**
   * Knopf am rechten Rand des Spurkopfs, zeigt Orbit bzw. MIDI-Kanal. Öffnet das Menü mit der Wahl von Orbit bzw. Kanal,
   * der Art der Spur (Klang, Noten, MIDI, Sampler), dem Wechsel zwischen Code und UI, dem Zurücksetzen und dem Entfernen.
   */
  let { track, index, showCode = $bindable() }: { track: Track; index: number; showCode: boolean } = $props();

  let open = $state(false);
  let root = $state<HTMLElement>();
  let trigger = $state<HTMLButtonElement>();

  const isRaw = $derived(track.code !== null);
  const isMidi = $derived(track.type === 'midi');
  /** Orbit (Klang, Noten, Sampler) bzw. MIDI-Kanal: gleiche Wahl, andere Zahl und anderes Feld. */
  const numbers = $derived(Array.from({ length: isMidi ? CHANNEL_MAX : ORBIT_MAX }, (_, i) => i + 1));
  const current = $derived(isMidi ? track.channel : track.orbit);

  function setNumber(n: number) {
    if (isMidi) project.setChannel(track.id, n);
    else project.setOrbit(track.id, n);
  }

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
    (root?.querySelector<HTMLElement>('[aria-checked="true"]') ?? root?.querySelector<HTMLElement>('[role^="menuitem"]'))?.focus();
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
    class="trigger"
    class:set={!isRaw && current !== 1}
    aria-label={isRaw
      ? `Menü von Spur ${index + 1}`
      : `${isMidi ? 'MIDI-Kanal' : 'Orbit'} ${current}, Menü von Spur ${index + 1}`}
    title={isRaw
      ? 'Zurücksetzen, Entfernen'
      : isMidi
        ? `MIDI-Kanal ${current} (Code: .midichan). Menü: Kanal, Art, Code/UI, Zurücksetzen, Entfernen`
        : `Orbit ${current} (Code: .orbit), Spuren im selben Orbit teilen Hall und Delay. Menü: Orbit, Art, Code/UI, Zurücksetzen, Entfernen`}
    aria-haspopup="menu"
    aria-expanded={open}
    onclick={toggle}
  >
    {#if !isRaw}
      {#if isMidi}<small>ch</small>{/if}{current}
    {/if}
    <svg class="chevron" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" /></svg>
  </button>
  {#if open}
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div class="menu" role="menu" aria-label={`Spur ${index + 1}`} onkeydown={onMenuKey}>
      {#if track.code !== null}
        <!-- Roher Code: Art ergibt sich aus dem Code, eine UI gibt es nicht -->
        <p class="about">Eigener Code. Wird er als Spur verstanden, gibt es wieder Steine.</p>
      {:else}
        <p class="label" id={`num-${track.id}`}>{isMidi ? 'MIDI-Kanal' : 'Orbit'}</p>
        <div class="grid" role="group" aria-labelledby={`num-${track.id}`}>
          {#each numbers as n (n)}
            <button role="menuitemradio" aria-checked={current === n} onclick={() => choose(() => setNumber(n))}>{n}</button>
          {/each}
        </div>
        <hr />
        <p class="label" id={`kind-${track.id}`}>Art</p>
        <div class="grid two" role="group" aria-labelledby={`kind-${track.id}`}>
          {#each TYPES as t (t.type)}
            <button
              role="menuitemradio"
              aria-checked={track.type === t.type}
              title={`Code: ${t.about}`}
              onclick={() => choose(() => project.setType(track.id, t.type))}
            >
              {t.label}
            </button>
          {/each}
        </div>
        <hr />
        <p class="label" id={`view-${track.id}`}>Ansicht</p>
        <div class="grid two" role="group" aria-labelledby={`view-${track.id}`}>
          <button role="menuitemradio" aria-checked={!showCode} onclick={() => choose(() => (showCode = false))}>UI</button>
          <button role="menuitemradio" aria-checked={showCode} onclick={() => choose(() => (showCode = true))}>Code</button>
        </div>
      {/if}
      <hr />
      {#if track.code === null}
        <button
          role="menuitem"
          title="Alle Steine und Effekte weg, wie eine neue Spur dieser Art"
          onclick={() => choose(() => project.resetTrack(track.id))}
        >
          <span class="check" aria-hidden="true"></span>
          Spur zurücksetzen
        </button>
      {/if}
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
  /* So hoch wie M und S daneben; Ecken kommen von der Gruppe im Spurkopf */
  .trigger {
    height: 28px;
    min-width: 28px;
    padding: 0 6px 0 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border-color: var(--line);
    border-radius: inherit;
    color: var(--mute);
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .trigger.set,
  .trigger:hover,
  .trigger[aria-expanded='true'] {
    color: var(--ink);
  }
  .trigger small {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    opacity: 0.8;
  }
  .chevron {
    width: 10px;
    height: 10px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  /* Orbit bzw. Kanal, Art und Ansicht: Wahl in einem Raster statt einer langen Liste */
  .menu .grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 2px;
  }
  .menu .grid.two {
    grid-template-columns: repeat(2, 1fr);
  }
  .menu .grid button {
    justify-content: center;
    padding: 6px 0;
    font-variant-numeric: tabular-nums;
  }
  .menu .grid button[aria-checked='true'] {
    background: color-mix(in srgb, var(--blue) 28%, transparent);
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
  .label {
    margin: 6px 8px 2px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--mute);
  }
  .about {
    margin: 4px 8px;
    max-width: 220px;
    font-size: 13px;
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
