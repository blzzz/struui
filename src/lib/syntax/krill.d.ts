// Strudels Grammatik für die Mini-Notation (von Peggy erzeugt, ohne Abhängigkeiten). Keine Typen mitgeliefert.
declare module '@strudel/mini/krill-parser.js' {
  export function parse(input: string, options?: Record<string, unknown>): unknown;
}
