<script lang="ts">
  import { TIMES_VALUES } from '../domain/arrangement.ts';
  import { tokenGestures } from '../interaction/token-gestures.ts';
  import { ARRANGEMENT_LANE, arrangement } from '../state/arrangement.svelte.ts';
  import { scenes } from '../state/scenes.svelte.ts';
  import Knob from './Knob.svelte';

  interface Props {
    /** Szene wählen (fragt bei nicht übernommenen Änderungen nach). */
    onSelect(sceneId: string): void;
  }
  let { onSelect }: Props = $props();

  /**
   * Offenes Menü über einem Abschnitt, wie bei den Steinen der Spuren: nur Icons. Fest am Fenster, weil die Zeile
   * scrollt und es sonst abschneiden würde; deshalb hier die Lage des Steins.
   */
  let menu = $state<{ id: string; sceneId: string; left: number; bottom: number } | null>(null);

  function toggleMenu(id: string, sceneId: string) {
    if (menu?.id === id) {
      menu = null;
      return;
    }
    const el = document.querySelector(`[data-section="${id}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    menu = { id, sceneId, left: r.left + r.width / 2, bottom: window.innerHeight - r.top + 6 };
  }

  /** Schliesst den Dropdown bei einem Tipp ausserhalb, mit Escape oder beim Scrollen. */
  function closeOutside(node: HTMLElement) {
    const down = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!node.contains(t) && !t.closest('[data-section]')) menu = null;
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') menu = null;
    };
    const close = () => (menu = null);
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }

  const name = (sceneId: string) => scenes.list.find((s) => s.id === sceneId)?.name ?? '?';

  /** Abschnitt antippen öffnet das Menü, doppelt antippen wählt seine Szene, Ziehen verschiebt ihn in der Zeile. */
  function gestures(id: string, sceneId: string) {
    return tokenGestures(() => ({
      onTap: () => toggleMenu(id, sceneId),
      onDoubleTap: () => {
        menu = null;
        onSelect(sceneId);
      },
      canDrag: (dx, dy) => Math.abs(dy) > Math.abs(dx),
      onDragMove: (t) => {
        menu = null;
        arrangement.hint = t?.laneId === ARRANGEMENT_LANE ? t.index : null;
      },
      onDrop: (t) => {
        if (t?.laneId === ARRANGEMENT_LANE) arrangement.move(id, t.index);
      },
    }));
  }
</script>

<!-- Arrangement wie eine Steinreihe: Szenen hintereinander, darunter der !-Knopf mit der Zahl der Zyklen -->
<div
  class="arr"
  role="list"
  aria-label="Arrangement"
  data-lane={ARRANGEMENT_LANE}
  data-lane-end={arrangement.sections.length}
>
  {#each arrangement.sections as x, i (x.id)}
    <div
      class="cell"
      role="listitem"
      data-drop-lane={ARRANGEMENT_LANE}
      data-drop-index={i}
      data-drop-kind="col"
      class:hint={arrangement.hint === i}
      class:playing={arrangement.position?.sectionId === x.id}
      class:hint-after={i === arrangement.sections.length - 1 && arrangement.hint === i + 1}
    >
      <div
        class="section"
        class:on={x.sceneId === scenes.current.id}
        data-section={x.id}
        role="button"
        tabindex="0"
        aria-haspopup="menu"
        aria-expanded={menu?.id === x.id}
        title="Antippen: Menü, doppelt antippen: Szene bearbeiten, ziehen: verschieben"
        {@attach gestures(x.id, x.sceneId)}
      >
        {name(x.sceneId)}
      </div>
      <Knob
        values={TIMES_VALUES}
        current={x.times}
        symbol="!"
        label="Zyklen"
        tone="green"
        placeholder="!"
        text={String}
        onTap={() => {}}
        onStage={(s) => arrangement.setTimes(x.id, TIMES_VALUES[s])}
      />
    </div>
  {:else}
    <p class="empty">Arrangement: Szenen hierher ziehen. Der !-Knopf darunter zählt die Zyklen.</p>
  {/each}
</div>

{#if menu}
  {@const m = menu}
  <div class="menu" role="menu" aria-label={name(m.sceneId)} style:left="{m.left}px" style:bottom="{m.bottom}px" {@attach closeOutside}>
    <button
      role="menuitem"
      aria-label="Szene bearbeiten"
      title="Szene bearbeiten"
      onclick={() => {
        menu = null;
        onSelect(m.sceneId);
      }}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13l.8-3.2L10.5 3.1l2.4 2.4-6.7 6.7zM9.3 4.3l2.4 2.4" /></svg>
    </button>
    <button
      role="menuitem"
      aria-label="Aus dem Arrangement entfernen"
      title="Aus dem Arrangement entfernen"
      onclick={() => {
        menu = null;
        arrangement.remove(m.id);
      }}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5M7 7v4M9 7v4" /></svg>
    </button>
  </div>
{/if}

<style>
  .arr {
    --s: 34px;
    min-width: 0;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    padding: 0 4px;
    border-radius: 10px;
  }
  .arr:has(.empty) {
    outline: 1.5px dashed var(--line);
    outline-offset: -1.5px;
  }
  .empty {
    margin: 0 4px;
    font-size: 13px;
    color: var(--mute);
  }
  /* Wie eine Spalte einer Steinreihe: Stein oben, Knopf darunter */
  .cell {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 0 2px;
  }
  .hint {
    box-shadow: -4px 0 0 0 var(--blue);
  }
  .hint-after {
    box-shadow: 4px 0 0 0 var(--blue);
  }
  /* Der Abschnitt, der gerade spielt: Balken unter dem Stein */
  .playing .section {
    box-shadow:
      inset 0 -3px 0 var(--wood-edge),
      0 4px 0 -1px var(--green);
  }
  .section {
    position: relative;
    display: flex;
    align-items: center;
    height: 40px;
    padding: 0 14px;
    border-radius: 8px;
    background: var(--wood);
    color: var(--wood-ink);
    box-shadow: inset 0 -3px 0 var(--wood-edge);
    font-weight: 700;
    font-size: 14px;
    white-space: nowrap;
    cursor: grab;
    touch-action: pan-x;
    user-select: none;
    -webkit-user-select: none;
  }
  .section.on {
    outline: 3px solid var(--on);
    outline-offset: 1px;
  }
  /* Wie das Menü der Steine (`TokenStone.svelte`): eine Reihe Icon-Knöpfe über dem Stein, mittig zu ihm */
  .menu {
    position: fixed;
    z-index: 25;
    transform: translateX(-50%);
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--panel);
    border: 1.5px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
  }
  .menu button {
    width: 34px;
    height: 34px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-color: var(--line);
  }
  .menu svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
