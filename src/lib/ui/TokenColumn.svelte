<script lang="ts">
  import { hasModifiers, hasSteps } from '../domain/types.ts';
  import { session } from '../state/session.svelte.ts';
  import ModSlot from './ModSlot.svelte';
  import TokenStone from './TokenStone.svelte';
  import type { Token } from '../domain/types.ts';

  let {
    token,
    laneId,
    index,
    error,
    value = false,
    readonly = false,
    spanned = false,
  }: {
    token: Token;
    laneId: string;
    index: number;
    error: boolean;
    value?: boolean;
    /** Eingeklappte Spur: kein Ablageziel, der Stein reagiert nicht. */
    readonly?: boolean;
    /** Liegt im Bereich, den ein Klammerpaar beim Umschliessen fassen würde. */
    spanned?: boolean;
  } = $props();

  const over = $derived(session.dropHint?.laneId === laneId && session.dropHint.index === index);
  /** Strich davor (einfügen) oder Hervorhebung des Steins (ersetzen). */
  const hint = $derived(over && !session.dropHint?.replace);
  const replacing = $derived(over && !!session.dropHint?.replace);
  /** Klänge und rohe Steine lassen sich durch einen Klang aus der Palette ersetzen, Klammern nicht. */
  const replaceable = $derived(!value && (token.kind === 'sound' || token.kind === 'raw'));
</script>

<div
  class="col"
  class:hint
  data-drop-lane={readonly ? undefined : laneId}
  data-drop-index={readonly ? undefined : index}
  data-drop-kind={readonly ? undefined : 'col'}
  data-drop-replaceable={readonly ? undefined : replaceable}
>
  <!-- Zufall oben: nur wenn die Spur ihn zeigt (Würfel im Kanalzug), sonst ein roter Punkt am Stein -->
  <div class="top">
    {#if hasModifiers(token)}
      <ModSlot kind="random" {token} />
    {:else}
      <div class="spacer"></div>
    {/if}
  </div>
  <TokenStone {token} {laneId} {error} {value} {readonly} {replacing} {spanned} />
  <!-- Drehknöpfe unten: nur wenn die Spur sie zeigt, sonst ein farbiger Balken am Stein -->
  <div class="bottom">
    {#if hasModifiers(token)}
      <ModSlot kind="repeat" {token} />
    {:else if hasSteps(token)}
      <ModSlot kind="steps" {token} />
    {:else}
      <div class="spacer"></div>
    {/if}
  </div>
</div>

<style>
  .col {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 2px;
    align-items: flex-start;
  }
  .spacer {
    width: var(--s);
    height: var(--s);
  }
  .hint { box-shadow: -4px 0 0 0 var(--blue); }
  :global(.compact) .col {
    gap: 0;
    padding: 0 1px;
  }
  :global(.norandom) .top,
  :global(.noknobs) .bottom {
    display: none;
  }
  :global(.compact) .spacer {
    display: none;
  }
</style>
