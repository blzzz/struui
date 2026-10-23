/**
 * Rückgängig-Liste für einen Zustand. Rein, ohne Abhängigkeit zu DOM, Svelte oder Audio.
 * Schnelle Folgen von Änderungen (Regler ziehen, Tippen) werden zu einem Schritt zusammengefasst.
 */

/** Änderungen, die näher als so viele Millisekunden beieinander liegen, sind ein Schritt. */
export const UNDO_GAP = 500;
/** Älteste Schritte fallen weg, wenn es mehr werden. */
export const UNDO_MAX = 100;

interface Entry<T> {
  state: T;
  /** Vergleichswert (z. B. JSON), gleich = kein neuer Schritt. */
  key: string;
}

export class UndoLog<T> {
  private past: Entry<T>[] = [];
  private base: Entry<T>;
  private last = -Infinity;

  constructor(state: T, key: string) {
    this.base = { state, key };
  }

  get depth(): number {
    return this.past.length;
  }

  /** Neuer Zustand. Beginnt eine neue Folge, wird der vorige Zustand zum Schritt, zu dem `undo` zurückführt. */
  record(state: T, key: string, now: number): void {
    if (key === this.base.key) return;
    if (now - this.last > UNDO_GAP) {
      this.past.push(this.base);
      if (this.past.length > UNDO_MAX) this.past.shift();
    }
    this.last = now;
    this.base = { state, key };
  }

  /** Zustand vor dem letzten Schritt, oder null. Die nächste Änderung beginnt einen neuen Schritt. */
  undo(): T | null {
    const e = this.past.pop();
    if (!e) return null;
    this.base = e;
    this.last = -Infinity;
    return e.state;
  }
}
