<script lang="ts">
  import { session } from "../state/session.svelte.ts";

  /**
   * Zwei Schalter links von einer Steinreihe, zusammen so hoch wie ein Stein und auf seiner Höhe:
   * Würfel = Zufallsknöpfe über den Steinen (aus: roter Punkt am Stein, nicht änderbar),
   * Drehknopf = Knöpfe für Wiederholung und Modulo darunter (aus: farbiger Balken am Stein, nicht änderbar).
   * `id`: Spur oder Effekt, dessen Steine die Schalter betreffen. Der Vorfahre mit `.norandom`/`.noknobs` setzt der Aufrufer.
   * `knobsAtStart`: Drehknöpfe zu Beginn sichtbar (Standard). Bei false kehrt `session.noKnobs` das um (Klang der Noten).
   */
  let { id, knobsAtStart = true }: { id: string; knobsAtStart?: boolean } = $props();

  const showRandom = $derived(session.random.has(id));
  const showKnobs = $derived(session.noKnobs.has(id) !== knobsAtStart);
</script>

<div class="toggles">
  <button
    class="toggle dice"
    aria-pressed={showRandom}
    aria-label="Zufall bearbeiten"
    title={showRandom ? "Zufallsknöpfe verbergen" : "Zufallsknöpfe zeigen (?)"}
    onclick={() => session.toggleRandom(id)}
  >
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="2.5" />
      <circle cx="5.3" cy="5.3" r="1.1" />
      <circle cx="8" cy="8" r="1.1" />
      <circle cx="10.7" cy="10.7" r="1.1" />
    </svg>
  </button>
  <button
    class="toggle knobs"
    aria-pressed={showKnobs}
    aria-label="Wiederholung bearbeiten"
    title={showKnobs ? "Drehknöpfe verbergen" : "Drehknöpfe zeigen (* ! @ %)"}
    onclick={() => session.toggleKnobs(id)}
  >
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle class="ring" cx="8" cy="8" r="4.5" />
      <path d="M8 8l2.2-2.2" />
      <circle class="tick" cx="8" cy="1.6" r="0.9" />
      <circle class="tick" cx="13.5" cy="10.8" r="0.9" />
      <circle class="tick" cx="2.5" cy="10.8" r="0.9" />
    </svg>
  </button>
</div>

<style>
  /* Die Schaltergruppe ist so hoch wie ein Stein und steht auf Höhe der Steine der ersten Reihe
     (mit Zufallsknöpfen darüber um deren Zeile tiefer, siehe TokenColumn) */
  .toggles {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: var(--s);
    margin-top: calc(var(--s) + 2px);
  }
  :global(.norandom) .toggles {
    margin-top: 0;
  }
  /* Zurückhaltend: ohne Rand und Fläche, nur das Symbol. Aus blass, an weiss. */
  .toggle {
    flex: 1;
    width: 28px;
    min-height: 0;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--mute);
    opacity: 0.6;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .toggle:hover {
    opacity: 1;
  }
  .toggle svg {
    width: 16px;
    height: 16px;
  }
  .dice rect {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
  }
  .dice circle {
    fill: currentColor;
  }
  .knobs .ring,
  .knobs path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
  }
  .knobs .tick {
    fill: currentColor;
  }
  /* An: weiss (im hellen Farbschema wäre Weiss unsichtbar, dort die Textfarbe) */
  .toggle[aria-pressed="true"] {
    background: transparent;
    color: var(--ink);
    opacity: 1;
  }
  @media (prefers-color-scheme: dark) {
    .toggle[aria-pressed="true"] {
      color: #fff;
    }
  }
</style>
