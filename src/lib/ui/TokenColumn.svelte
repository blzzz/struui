<script lang="ts">
  import { hasModifiers, hasSteps, isPause } from '../domain/types.ts';
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
    spanned = false,
    last = false,
    stackPrev = false,
    stackNext = false,
  }: {
    token: Token;
    laneId: string;
    index: number;
    error: boolean;
    value?: boolean;
    /** Liegt im Bereich, den ein Klammerpaar beim Umschliessen fassen würde. */
    spanned?: boolean;
    /** Letzter Stein einer Reihe ohne Feld am Ende: zeigt auch das Einfügen dahinter. */
    last?: boolean;
    /** Stapel (`[bd, hh]`): hängt mit Komma am Stein davor bzw. der nächste hängt an ihm. Ohne Abstand dazwischen. */
    stackPrev?: boolean;
    stackNext?: boolean;
  } = $props();

  const over = $derived(session.dropHint?.laneId === laneId && session.dropHint.index === index);
  /** Strich davor (einfügen), Hervorhebung des Steins (ersetzen) oder Hervorhebung mit Strich danach (anfügen). */
  const hint = $derived(over && session.dropHint?.mode === 'insert');
  const replacing = $derived(over && session.dropHint?.mode === 'replace');
  const stacking = $derived(over && session.dropHint?.mode === 'stack');
  /** Strich danach: Einfügen am Ende der Reihe. */
  const hintAfter = $derived(
    last && session.dropHint?.laneId === laneId && session.dropHint.index === index + 1 && session.dropHint.mode === 'insert',
  );
  /** Klänge und rohe Steine lassen sich durch einen Klang aus der Palette ersetzen, Klammern nicht. */
  const replaceable = $derived(!value && (token.kind === 'sound' || token.kind === 'raw'));
  /** An Klänge (nicht Pausen, nicht rohe Steine) lässt sich durch Verweilen ein Klang mit Komma anfügen. */
  const stackable = $derived(replaceable && token.kind === 'sound' && !isPause(token));
</script>

<div
  class="col"
  class:hint
  class:hint-after={hintAfter}
  class:stacking
  class:stack-prev={stackPrev}
  class:stack-next={stackNext}
  data-drop-lane={laneId}
  data-drop-index={index}
  data-drop-kind="col"
  data-drop-replaceable={replaceable}
  data-drop-stackable={stackable}
>
  <!-- Zufall oben: nur wenn die Spur ihn zeigt (Würfel im Kanalzug), sonst ein roter Punkt am Stein -->
  <div class="top">
    {#if hasModifiers(token)}
      <ModSlot kind="random" {token} />
    {:else}
      <div class="spacer"></div>
    {/if}
  </div>
  <TokenStone {token} {laneId} {error} {value} {replacing} {stacking} {spanned} {stackPrev} {stackNext} />
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
  .hint-after { box-shadow: 4px 0 0 0 var(--blue); }
  .stacking { box-shadow: 4px 0 0 0 var(--green); }
  /* Stapel: Steine ohne Abstand nebeneinander */
  .stack-prev { padding-left: 0; }
  .stack-next { padding-right: 0; }
  :global(.norandom) .top,
  :global(.noknobs) .bottom {
    display: none;
  }
</style>
