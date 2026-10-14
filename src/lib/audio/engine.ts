import type { Program } from '../domain/codegen.ts';

export interface StatusMessage {
  kind: 'info' | 'error';
  text: string;
}

/** Was die Engine vom Projekt braucht. Sie kennt weder Svelte noch den Projektzustand. */
export interface EngineHost {
  /** Aktueller Code samt Positionen der Klangnamen. */
  getProgram(): Program;
  /** Hauptlautstärke (0–1). */
  getVolume(): number;
  /** IDs der Steine, die gerade erklingen (für die Hervorhebung). */
  setLit(ids: ReadonlySet<string>): void;
  /** Aktuelle Position in Zyklen (z. B. 3.25 = ein Viertel im vierten Zyklus). null = steht. */
  setCycle(position: number | null): void;
  setStatus(message: StatusMessage | null): void;
}
