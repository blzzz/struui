// Die Strudel-Pakete liefern keine Typen. Hier nur, was wir benutzen.
declare module '@strudel/core' {
  /** Eintrag aus hap.context.locations: Zeichenpositionen im ausgewerteten Code. */
  export interface Hap {
    context?: { locations?: { start: number; end: number }[] };
    [key: string]: unknown;
  }
  export type OutputFn = (hap: Hap, deadline: number, duration: number, cps: number, t: number) => unknown;

  /** `scheduler.now()` ist die aktuelle Position in Zyklen. Fehler beim Auswerten meldet `evaluate` nur über `onEvalError`. */
  export interface Repl {
    scheduler: { now(): number };
    evaluate(code: string, autostart?: boolean): Promise<unknown>;
    stop(): void;
  }

  export function evalScope(...modules: unknown[]): Promise<unknown>;
  export function setTime(getTime: () => number): void;
}

declare module '@strudel/webaudio' {
  import type { OutputFn, Repl } from '@strudel/core';
  export function webaudioRepl(options?: {
    defaultOutput?: OutputFn;
    transpiler?: unknown;
    onEvalError?: (error: Error) => void;
    [key: string]: unknown;
  }): Repl;
  export const webaudioOutput: OutputFn;
  export function initAudioOnFirstClick(): Promise<void>;
  export function getAudioContextCurrentTime(): number;
  export function getAudioContext(): AudioContext;
  /** Spielt einen Klang (Wert wie in einem Ereignis, z. B. `{ s: 'bd' }`) zur Zeit `t` auf der Audio-Uhr. */
  export function superdough(value: Record<string, unknown>, t: number, duration: number): Promise<void>;
  /** Meldet Klänge an: Name zu Adresse (auch Data-URL). */
  export function samples(map: Record<string, string>): Promise<void>;
  /** Adressen eines Sample-Klangs: Liste der Varianten oder, nach Tonhöhe, Note zu Liste (`piano`). */
  export type SampleBank = string[] | Record<string, string | string[]>;
  /** Aus superdough: angemeldeter Klang (Name in beliebiger Schreibweise). Samples haben `type: 'sample'`. */
  export function getSound(name: string): { data?: { type?: string; samples?: SampleBank } } | undefined;
  /** Aus superdough: lädt und dekodiert das Sample zu `{ s, n }` in Strudels Cache (nach Adresse). */
  export function getSampleBuffer(value: { s: string; n: number }, bank: SampleBank): Promise<unknown>;
  /** Aus superdough: Ausgang mit der Hauptlautstärke. */
  export function getSuperdoughAudioController(): { output: { destinationGain: GainNode | null } };
}

declare module '@strudel/transpiler' {
  export const transpiler: unknown;
}

declare module '@strudel/mini' {
  export function miniAllStrings(): void;
}
