// Das Prebake des offiziellen Pakets @strudel/repl: lädt dieselben Klangquellen wie die Strudel-Website.
declare module '@strudel/repl/prebake.mjs' {
  export function prebake(): Promise<void>;
}
