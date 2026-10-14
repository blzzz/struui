import { parse as krillParse } from '@strudel/mini/krill-parser.js';

/**
 * Fragt Strudels eigene Grammatik, ob ein Mini-Notation-Text gültig ist.
 * Wir importieren nur die Grammatik (rund 115 kB, ohne Strudel-Kern), nicht `@strudel/mini` als Ganzes.
 * Warum nicht `mini2ast`? Das verwirft die Fehlerposition, die Grammatik selbst liefert sie.
 */
export type Validation = { ok: true } | { ok: false; offset: number; message: string };

export function validateMini(text: string): Validation {
  try {
    krillParse(`"${text}"`);
    return { ok: true };
  } catch (e) {
    const err = e as { message?: string; location?: { start?: { offset?: number } } };
    // Die Grammatik erwartet den Text in Anführungszeichen, daher -1
    const offset = Math.max(0, (err.location?.start?.offset ?? 1) - 1);
    return { ok: false, offset, message: err.message ?? 'Syntaxfehler' };
  }
}

