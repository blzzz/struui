import type * as Core from '@strudel/core';

/**
 * Meldet `up` bei Strudel an: wie `set.mix`, überschreibt aber nur die Werte, die `vals` wirklich enthält.
 * Zusammen mit `as` ergibt das Paramlocks wie bei Elektron und setzt zugleich den Rhythmus (wie `struct`):
 *
 *   s("bd").n(5).room(0.1).up("<1 0.5 ~ 0.7:4>*8".as("velocity:n"))
 *
 * Muss nach dem Prebake laufen, das die globalen Funktionen sonst wieder überschreibt.
 */
export function registerUp(core: typeof Core): void {
  const up = core.register(
    'up',
    (vals: Core.Pattern, pat: Core.Pattern) =>
      pat
        .withValue((v: object) => (vNew: object) => {
          const vUp = Object.fromEntries(Object.entries(vNew).filter(([, val]) => val !== undefined));
          return { ...v, ...vUp };
        })
        .appBoth(core.reify(vals)),
    false,
  );
  (globalThis as Record<string, unknown>).up = up;
}
