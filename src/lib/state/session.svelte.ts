import type { StatusMessage } from '../audio/engine.ts';
import type { GroupType } from '../domain/types.ts';

export interface SheetTarget {
  /** Steinreihe: Spur oder Effekt (siehe `project.lane`). */
  laneId: string;
  /** null = am Ende der Spur anhängen. */
  tokenId: string | null;
}

export interface DropHint {
  laneId: string;
  /** Den Stein an `index` ersetzen (Hervorhebung des Steins) statt davor einfügen (Strich). */
  replace: boolean;
  /** Einfügeposition: der Strich erscheint vor diesem Stein. */
  index: number;
}

/**
 * Umschliessen im Gang: im Steinmenü gewählt, jetzt wird der Stein angetippt, bis zu dem das Klammerpaar reicht.
 * `hoverId`: Stein unter der Maus, für die Vorschau des Bereichs.
 */
export interface WrapPick {
  laneId: string;
  tokenId: string;
  group: GroupType;
  hoverId: string | null;
}

/** Hauptansicht: Steine oder der ganze Code. */
export type View = 'ui' | 'code';

/** Flüchtiger Oberflächenzustand, der nicht zum Projekt gehört. */
class Session {
  playing = $state(false);
  /** Hauptlautstärke (0–1), wirkt auf Strudels Ausgang, nicht im Code. */
  volume = $state(1);
  view = $state<View>('ui');
  /** Erklärungsdialog offen. */
  help = $state(false);
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
   * Effektlisten (Spur und Art, siehe `EffectList`), deren Boxen auf eine Zeile verkleinert sind.
   * Anders als bei den Steinreihen ist der Standard die Originalgrösse (Menge leer).
   */
  fitEffects = $state<ReadonlySet<string>>(new Set());
  /**
   * Effekte, deren Box die Wertsteine (Mini-Notation) statt des Reglers zeigt. Ist der Wert mehr als ein einzelner Stein,
   * zeigt die Box die Wertsteine ohnehin. Standard: Regler (Menge leer).
   */
  mini = $state<ReadonlySet<string>>(new Set());
  lit = $state<ReadonlySet<string>>(new Set());
  /** Position in Zyklen, solange abgespielt wird. */
  cycle = $state<number | null>(null);
  status = $state<StatusMessage | null>(null);
  sheet = $state<SheetTarget | null>(null);
  /** Kleines Menü über einem angetippten Stein (Entfernen, Ersetzen). */
  menu = $state<{ laneId: string; tokenId: string } | null>(null);
  dropHint = $state<DropHint | null>(null);
  wrap = $state<WrapPick | null>(null);
  /** Klangpalette unter der oberen Leiste ausgeklappt. */
  paletteOpen = $state(true);
  /** Eben über das + angehängter Noten- oder Wertstein: öffnet sich beim Erscheinen gleich zum Tippen. */
  editNew = $state<string | null>(null);

  startWrap(laneId: string, tokenId: string, group: GroupType): void {
    this.menu = null;
    this.wrap = { laneId, tokenId, group, hoverId: null };
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
  /** Effektliste zwischen Originalgrösse und «auf eine Zeile verkleinert» umschalten. */
  toggleFitEffects(listId: string): void {
    const next = new Set(this.fitEffects);
    if (!next.delete(listId)) next.add(listId);
    this.fitEffects = next;
  }
}

export const session = new Session();
