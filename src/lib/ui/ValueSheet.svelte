<script lang="ts">
  import { isValueAtom } from '../domain/effects.ts';
  import { project } from '../state/project.svelte.ts';
  import type { PlaceMode } from '../state/project.svelte.ts';
  import { session } from '../state/session.svelte.ts';
  import type { GroupType } from '../domain/types.ts';

  let dialog = $state<HTMLDialogElement>();
  let mode = $state<PlaceMode>('replace');

  const target = $derived(session.sheet);
  const editing = $derived(target !== null && target.tokenId !== null);
  /** In einer Effektreihe: Werte statt Klänge. */
  const lane = $derived(target ? project.lane(target.laneId) : null);
  /** Beschreibung der Wertreihe: Effekt, Rechenart oder Sampler-Art (`scrub`, `slice`). */
  const info = $derived(lane?.info ?? undefined);
  const fx = $derived(info ? { name: info.name } : null);
  /** Eingabe für einen eigenen Wert. */
  let draft = $state('');
  const draftOk = $derived(isValueAtom(draft.trim()));

  $effect(() => {
    if (!dialog) return;
    if (target && !dialog.open) {
      mode = 'replace';
      const current = lane?.tokens.find((t) => t.id === target.tokenId);
      draft = current?.kind === 'sound' ? current.sound : '';
      dialog.showModal();
    } else if (!target && dialog.open) {
      dialog.close();
    }
  });

  function close() {
    session.closeSheet();
  }

  function pickSound(name: string) {
    if (!target) return;
    project.placeSound(target.laneId, target.tokenId, mode, name);
    close();
  }

  function pickPair(group: GroupType) {
    if (!target) return;
    project.placePair(target.laneId, target.tokenId, mode, group);
    close();
  }

  function submitValue(e: SubmitEvent) {
    e.preventDefault();
    if (draftOk) pickSound(draft.trim());
  }

  function remove() {
    if (target?.tokenId) project.removeToken(target.laneId, target.tokenId);
    close();
  }

</script>

<dialog
  bind:this={dialog}
  onclose={close}
  onclick={(e) => {
    if (e.target === dialog) close();
  }}
>
  <div class="box">
    <p class="title">
      {editing ? 'Wert bearbeiten' : 'Wert anhängen'}{#if fx}&nbsp;für <code>.{fx.name}</code>{/if}
    </p>

    {#if editing}
      <div class="seg">
        <button aria-pressed={mode === 'replace'} onclick={() => (mode = 'replace')}>Ersetzen</button>
        <button aria-pressed={mode === 'insert'} onclick={() => (mode = 'insert')}>Davor einfügen</button>
      </div>
    {/if}

    {#if info?.description}<p class="about">{info.description}</p>{/if}
    <form class="value" onsubmit={submitValue}>
      <input
        type="text"
        bind:value={draft}
        placeholder={info?.hint || 'Zahl oder Name'}
        aria-label={`Wert für ${fx?.name ?? ""}`}
        aria-invalid={draft.trim() !== '' && !draftOk}
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
      />
      <button type="submit" class="val" disabled={!draftOk}>{editing && mode === 'replace' ? 'Setzen' : 'Anhängen'}</button>
    </form>
    {#if info?.hint}<p class="hint">{info.hint}</p>{/if}
    {#if info && info.values.length > 0}
      <p class="head">Werte aus Strudels Beispielen (beim Bearbeiten im Stein springen ↑/↓ und −/+ zwischen ihnen)</p>
      <div class="grid">
        {#each info.values as v (v)}
          <button class="val" onclick={() => pickSound(v)}>{v}</button>
        {/each}
      </div>
    {/if}

    {#if editing}
      <p class="head">Klammern (immer als Paar; bei Ersetzen umschliessen sie den Stein)</p>
      <div class="grid three">
        <button class="br1" onclick={() => pickPair('[')}>[ ]</button>
        <button class="br2" onclick={() => pickPair('<')}>&lt; &gt;</button>
        <button class="br3" onclick={() => pickPair('{')}>{'{ }'}</button>
      </div>

      <button class="remove" onclick={remove}>Entfernen</button>
    {/if}
    <button class="wide" onclick={close}>Schliessen</button>
  </div>
</dialog>

<style>
  dialog {
    margin: auto 0 0;
    width: 100%;
    max-width: 640px;
    margin-inline: auto;
    padding: 0;
    border: none;
    border-radius: 14px 14px 0 0;
    background: var(--panel);
    color: var(--ink);
    max-height: 85%;
  }
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.45);
  }
  .box {
    padding: 14px 14px calc(14px + env(safe-area-inset-bottom, 0px));
  }
  .title {
    margin: 0 0 10px;
    font-size: 14px;
    color: var(--mute);
  }
  .head {
    font-size: 13px;
    color: var(--mute);
    margin: 10px 0 6px;
  }
  .seg,
  .grid {
    display: grid;
    gap: 8px;
    margin-bottom: 10px;
  }
  .seg {
    grid-template-columns: 1fr 1fr;
  }
  .grid {
    grid-template-columns: repeat(4, 1fr);
  }
  .grid.three {
    grid-template-columns: 1fr 1fr 1fr;
  }
  .grid button,
  .seg button {
    padding: 10px 3px;
    font-size: 13px;
    font-weight: 700;
    word-break: break-all;
  }
  .val {
    background: var(--val);
    color: var(--val-ink);
    border-color: var(--val-edge);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .val:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .about,
  .hint {
    font-size: 13px;
    color: var(--mute);
    margin: 0 0 8px;
  }
  .hint {
    margin-top: -4px;
  }
  .value {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
  }
  .value input {
    flex: 1;
    min-width: 0;
    padding: 8px 10px;
    border: 1.5px solid var(--line);
    border-radius: 8px;
    background: var(--bg);
    color: var(--ink);
    /* 16px verhindert das automatische Zoomen auf iOS */
    font: 16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .value input:focus {
    outline: none;
    border-color: var(--blue);
  }
  .value input[aria-invalid='true'] {
    border-color: var(--red);
  }
  .br1,
  .br2,
  .br3 {
    color: #fff;
    font-size: 20px !important;
    font-weight: 500 !important;
  }
  .br1 { background: var(--br1); border-color: var(--br1); }
  .br2 { background: var(--br2); border-color: var(--br2); }
  .br3 { background: var(--br3); border-color: var(--br3); }
  .remove,
  .wide {
    width: 100%;
    margin-bottom: 8px;
  }
  .remove {
    border-color: var(--red);
    color: var(--red);
  }
</style>
