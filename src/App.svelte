<script lang="ts">
  import { untrack } from "svelte";
  import CodeView from "./lib/ui/CodeView.svelte";
  import SoundPalette from "./lib/ui/SoundPalette.svelte";
  import SceneDock from "./lib/ui/SceneDock.svelte";
  import HelpDialog from "./lib/ui/HelpDialog.svelte";
  import ValueSheet from "./lib/ui/ValueSheet.svelte";
  import TopBar from "./lib/ui/TopBar.svelte";
  import Board from "./lib/ui/Board.svelte";
  import { history } from "./lib/state/history.svelte.ts";
  import { playback } from "./lib/state/playback.svelte.ts";
  import { project } from "./lib/state/project.svelte.ts";
  import { scenes } from "./lib/state/scenes.svelte.ts";
  import { session } from "./lib/state/session.svelte.ts";

  // Läuft die Wiedergabe, bekommt die Engine jede Codeänderung mit.
  $effect(() => {
    void playback.program().code;
    untrack(() => playback.changed());
  });

  // Mit Auto-Update landet jede Änderung sofort in der gewählten Szene.
  $effect(() => {
    if (scenes.autoUpdate && scenes.dirty) untrack(() => scenes.update());
  });

  // Jede Änderung an Spuren und Tempo kommt in den Verlauf der gewählten Szene.
  $effect(() => {
    void scenes.currentId;
    void project.cps;
    void JSON.stringify(project.tracks);
    untrack(() => history.record());
  });

  /** Strg/⌘+Z macht rückgängig, ausser in Textfeldern (die haben ihr eigenes). */
  function onKey(e: KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "z") return;
    const t = e.target as HTMLElement | null;
    if (t?.closest?.("input, textarea, [contenteditable]")) return;
    e.preventDefault();
    history.undo();
  }
</script>

<svelte:window onkeydown={onKey} />

<TopBar />

<main class:fill={session.view === "ui"}>
  {#if session.status}
    <p
      class="status"
      class:error={session.status.kind === "error"}
      role="status"
    >
      {session.status.text}
    </p>
  {/if}

  {#if session.view === "ui"}
    <SoundPalette />
    <!-- Spuren als Rechtecke auf einer Fläche, neue Spuren über die Plus-Knöpfe an ihrem Rand -->
    <Board />
  {:else}
    <div class="pad">
      <CodeView />
    </div>
  {/if}
</main>

<SceneDock />
<ValueSheet />
<HelpDialog />

<style>
  main {
    width: 100%;
    min-height: 100dvh;
    padding: calc(var(--bar-h) + env(safe-area-inset-top, 0px)) 0
      calc(var(--dock-h) + 40px + env(safe-area-inset-bottom, 0px));
  }
  /* Steine: die Seite scrollt nicht, die Fläche füllt den Platz zwischen den Leisten und scrollt selbst */
  main.fill {
    height: 100dvh;
    padding-bottom: calc(var(--dock-h) + env(safe-area-inset-bottom, 0px));
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .pad {
    padding: 12px max(12px, env(safe-area-inset-right, 0px)) 0
      max(12px, env(safe-area-inset-left, 0px));
  }
  .status {
    font-size: 13px;
    color: var(--mute);
    margin: 0;
    padding: 6px 12px;
    border-bottom: 1.5px solid var(--line);
  }
  .status.error {
    color: var(--red);
  }
</style>
