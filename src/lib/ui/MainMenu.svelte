<script lang="ts">
  import { tick } from 'svelte';
  import { patterns } from '../state/patterns.svelte.ts';
  import { session } from '../state/session.svelte.ts';

  /** Burger-Menü oben rechts: neues Pattern, Pattern laden (`PatternDialog`), Ansicht (Steine oder Code), Hilfe (`HelpDialog`). */
  let open = $state(false);
  let root = $state<HTMLElement>();
  let trigger = $state<HTMLButtonElement>();

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
    await tick();
    root?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
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
    class="burger"
    aria-label="Menü"
    title="Neues Pattern, Pattern laden, Ansicht, Hilfe"
    aria-haspopup="menu"
    aria-expanded={open}
    onclick={toggle}
  >
    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4h11M2.5 8h11M2.5 12h11" /></svg>
  </button>
  {#if open}
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div class="menu" role="menu" aria-label="Menü" onkeydown={onMenuKey}>
      <button role="menuitem" onclick={() => choose(() => patterns.create())}>Neues Pattern</button>
      <button role="menuitem" onclick={() => choose(() => (session.patterns = true))}>Pattern laden …</button>
      <hr />
      <button role="menuitemradio" aria-checked={session.view === 'ui'} onclick={() => choose(() => (session.view = 'ui'))}>
        Steine
      </button>
      <button role="menuitemradio" aria-checked={session.view === 'code'} onclick={() => choose(() => (session.view = 'code'))}>
        Code
      </button>
      <hr />
      <button role="menuitem" onclick={() => choose(() => (session.help = true))}>Hilfe</button>
    </div>
  {/if}
</div>

<style>
  .wrap {
    position: relative;
    flex: none;
  }
  /* Ohne Rand, nur das Symbol */
  .burger {
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    display: grid;
    place-items: center;
  }
  .burger svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
  }
  .menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    min-width: 200px;
    background: var(--panel);
    border: 1.5px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
  }
  .menu button {
    width: 100%;
    text-align: left;
    padding: 8px 10px;
    font-size: 14px;
    border-color: transparent;
    background: transparent;
    color: var(--ink);
  }
  /* Platz für das Häkchen der gewählten Ansicht */
  .menu button[role='menuitemradio'] {
    padding-left: 28px;
    position: relative;
    font-weight: 500;
  }
  .menu button[aria-checked='true']::before {
    content: '✓';
    position: absolute;
    left: 10px;
  }
  .menu button:hover {
    background: color-mix(in srgb, var(--blue) 14%, transparent);
  }
  hr {
    width: 100%;
    margin: 4px 0;
    border: none;
    border-top: 1px solid var(--line);
  }
</style>
