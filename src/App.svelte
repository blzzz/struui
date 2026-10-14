<script lang="ts">
  import { untrack } from 'svelte';
  import CodeView from './lib/ui/CodeView.svelte';
  import SnapshotDock from './lib/ui/SnapshotDock.svelte';
  import HelpDialog from './lib/ui/HelpDialog.svelte';
  import ValueSheet from './lib/ui/ValueSheet.svelte';
  import TopBar from './lib/ui/TopBar.svelte';
  import TrackView from './lib/ui/TrackView.svelte';
  import { playback } from './lib/state/playback.svelte.ts';
  import { project } from './lib/state/project.svelte.ts';
  import { session } from './lib/state/session.svelte.ts';

  // Läuft die Wiedergabe, bekommt die Engine jede Codeänderung mit.
  $effect(() => {
    void project.program.code;
    untrack(() => playback.changed());
  });
</script>

<TopBar />

<main>
  {#if session.status}
    <p class="status" class:error={session.status.kind === 'error'} role="status">{session.status.text}</p>
  {/if}

  {#if session.view === 'ui'}
    {#each project.tracks as track, i (track.id)}
      <TrackView {track} index={i} />
    {/each}
    <!-- Neue Spur gleich in der gewünschten Art (später im Menü der Spur umschaltbar) -->
    <div class="pad addtracks">
      <button class="addtrack" onclick={() => project.addTrack('sound')}>+ Klangspur</button>
      <button class="addtrack" onclick={() => project.addTrack('note')}>+ Notenspur</button>
      <button class="addtrack" onclick={() => project.addTrack('midi')}>+ MIDI-Spur</button>
    </div>
  {:else}
    <div class="pad">
      <CodeView />
    </div>
  {/if}
</main>

<SnapshotDock />
<ValueSheet />
<HelpDialog />

<style>
  main {
    width: 100%;
    min-height: 100dvh;
    padding: calc(var(--bar-h) + env(safe-area-inset-top, 0px)) 0 calc(var(--dock-h) + 40px + env(safe-area-inset-bottom, 0px));
  }
  .pad {
    padding: 12px max(12px, env(safe-area-inset-right, 0px)) 0 max(12px, env(safe-area-inset-left, 0px));
  }
  .addtracks {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .addtrack {
    flex: 1 1 140px;
    border-style: dashed;
    border-color: var(--mute);
    color: var(--mute);
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
