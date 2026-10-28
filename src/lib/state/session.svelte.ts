import type { StatusMessage } from '../audio/engine.ts';

export interface SheetTarget {
  /** Steinreihe: Spur oder Effekt (siehe `project.lane`). */
  laneId: string;
  /** null = am Ende der Spur anhängen. */
  tokenId: string | null;
}

export interface DropHint {
  laneId: string;
  /**
   * `insert`: davor einfügen (Strich). `replace`: den Stein an `index` ersetzen (Hervorhebung des Steins).
   * `stack`: mit Komma an ihn anfügen (Hervorhebung und Strich danach).
   */
  mode: 'insert' | 'replace' | 'stack';
  /** Einfügeposition: der Strich erscheint vor diesem Stein. Bei `replace` und `stack` der Stein selbst. */
  index: number;
}

/**
 * Auswahl im Gang: im Steinmenü mit «Auswählen» begonnen, bei `fromId`. Antippen eines anderen Steins der Reihe setzt
 * das Ende (`toId`). Erst danach (`chosen`) bietet die Leiste über dem Bereich Umschliessen, Entfernen und Verdoppeln
 * (`Lane.svelte`), vorher fordert sie zum Wählen auf.
 */
export interface Selection {
  laneId: string;
  fromId: string;
  toId: string;
  /** Das Ende wurde angetippt (auch der Startstein selbst zählt). */
  chosen: boolean;
}

/** Hauptansicht: Steine oder der ganze Code. */
export type View = 'ui' | 'code';

/** Flüchtiger Oberflächenzustand, der nicht zum Projekt gehört. */
class Session {
  playing = $state(false);
  /** Was spielt bzw. zuletzt spielte: die gewählte Szene (Play oben) oder das Arrangement (▶ vor dem Arrangement). */
  playMode = $state<'scene' | 'arrangement'>('scene');
  /** Hauptlautstärke (0–1), wirkt auf Strudels Ausgang, nicht im Code. */
  volume = $state(1);
  view = $state<View>('ui');
  /** Erklärungsdialog offen. */
  help = $state(false);
  /** Liste der gespeicherten Patterns (Laden, Löschen) offen. */
  patterns = $state(false);
  /**
   * Spuren, die über den Steinen die Zufallsknöpfe (`?`) zeigen. Sonst ist Zufall nur ein roter Punkt am Stein
   * und lässt sich nicht ändern. Standard: aus.
   */
  random = $state<ReadonlySet<string>>(new Set());
  /**
   * Spuren, die unter den Steinen keine Drehknöpfe (Wiederholung, Modulo) zeigen. Dann sind sie nur
   * farbige Balken am Stein. Standard: Knöpfe sichtbar (Menge leer).
   */
  noKnobs = $state<ReadonlySet<string>>(new Set());
  /**
   * Steinreihen in Originalgrösse. Sonst wird eine Reihe, die nicht auf eine Zeile passt, verkleinert (`Lane`).
   * Standard: verkleinern (Menge leer).
   */
  unfit = $state<ReadonlySet<string>>(new Set());
  /**
   * Spuren, deren Effekte rechts neben der Notation stehen (senkrechter Trennstrich, «inline»).
   * Standard: darunter (waagrechter Strich, «block», Menge leer).
   */
  inlineFx = $state<ReadonlySet<string>>(new Set());
  /**
   * Gezogene Aufteilung bei Effekten rechts daneben: Anteil der Notation am Platz (0–1).
   * Ohne Eintrag richten sich die Effekte nach ihrem Inhalt, höchstens die halbe Breite.
   */
  fxSplit = $state<ReadonlyMap<string, number>>(new Map());
  /**
   * Effekte, deren Box die Wertsteine (Mini-Notation) statt des Reglers zeigt. Ist der Wert mehr als ein einzelner Stein,
   * zeigt die Box die Wertsteine ohnehin. Standard: Regler (Menge leer).
   */
  mini = $state<ReadonlySet<string>>(new Set());
  /** Markierte Effekt-Box (Antippen der Box), Delete entfernt sie. */
  selectedEffect = $state<string | null>(null);
  /**
   * Spuren auf Solo. Ist eine davon in der Szene, schweigen alle anderen (im Code `.hush()`, `Track.muted` bleibt).
   * Flüchtig: wird der Code von Hand bearbeitet, während Solo an ist, werden die `.hush()` zur echten Stummschaltung.
   */
  solo = $state<ReadonlySet<string>>(new Set());
  lit = $state<ReadonlySet<string>>(new Set());
  /** Position in Zyklen, solange abgespielt wird. */
  cycle = $state<number | null>(null);
  status = $state<StatusMessage | null>(null);
  sheet = $state<SheetTarget | null>(null);
  /** Kleines Menü über einem angetippten Stein (Entfernen, Verdoppeln, Auswählen). */
  menu = $state<{ laneId: string; tokenId: string } | null>(null);
  dropHint = $state<DropHint | null>(null);
  selection = $state<Selection | null>(null);
  /** Eben über das + angehängter Noten- oder Wertstein: öffnet sich beim Erscheinen gleich zum Tippen. */
  editNew = $state<string | null>(null);

  startSelection(laneId: string, tokenId: string): void {
    this.menu = null;
    this.selection = { laneId, fromId: tokenId, toId: tokenId, chosen: false };
  }
  openMenu(laneId: string, tokenId: string): void {
    const same = this.menu?.laneId === laneId && this.menu.tokenId === tokenId;
    this.menu = same ? null : { laneId, tokenId };
  }
  openSheet(laneId: string, tokenId: string | null): void {
    this.menu = null;
    this.sheet = { laneId, tokenId };
  }
  closeSheet(): void {
    this.sheet = null;
  }
  /** Zufallsknöpfe über den Steinen einer Spur zeigen oder verbergen. */
  toggleRandom(trackId: string): void {
    const next = new Set(this.random);
    if (!next.delete(trackId)) next.add(trackId);
    this.random = next;
  }
  /** Solo einer Spur ein- oder ausschalten. Mehrere Spuren können gleichzeitig Solo sein. */
  toggleSolo(trackId: string): void {
    const next = new Set(this.solo);
    if (!next.delete(trackId)) next.add(trackId);
    this.solo = next;
  }
  /** Drehknöpfe unter den Steinen einer Spur zeigen oder verbergen. */
  toggleKnobs(trackId: string): void {
    const next = new Set(this.noKnobs);
    if (!next.delete(trackId)) next.add(trackId);
    this.noKnobs = next;
  }
  /** Steinreihe zwischen «auf eine Zeile verkleinert» und Originalgrösse umschalten. */
  toggleFit(laneId: string): void {
    const next = new Set(this.unfit);
    if (!next.delete(laneId)) next.add(laneId);
    this.unfit = next;
  }
  /** Effekt-Box zwischen Regler und Wertsteinen (Mini-Notation) umschalten. */
  toggleMini(effectId: string): void {
    const next = new Set(this.mini);
    if (!next.delete(effectId)) next.add(effectId);
    this.mini = next;
  }
  /** Effekte einer Spur zwischen «unter der Notation» und «rechts daneben» umschalten. */
  toggleInlineFx(trackId: string): void {
    const next = new Set(this.inlineFx);
    if (!next.delete(trackId)) next.add(trackId);
    this.inlineFx = next;
  }
  /** Aufteilung zwischen Notation und Effekten setzen, `null` = wieder nach Inhalt. */
  setFxSplit(trackId: string, ratio: number | null): void {
    const next = new Map(this.fxSplit);
    if (ratio === null) next.delete(trackId);
    else next.set(trackId, ratio);
    this.fxSplit = next;
  }
}

export const session = new Session();
