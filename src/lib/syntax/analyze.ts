import { trackToMiniWithRanges } from '../domain/codegen.ts';
import { parse } from '../domain/parse.ts';
import type { ParseResult } from '../domain/parse.ts';
import type { Token } from '../domain/types.ts';
import { validateMini } from './validate.ts';

/**
 * Prüft eine Spur zweistufig:
 * 1. Der eigene Parser liefert Baum, Gruppentiefe und genaue Fehlerstellen (welcher Stein ist falsch?).
 * 2. Findet er nichts, entscheidet Strudels Grammatik. Lehnt sie die Spur trotzdem ab, wird der Stein an der
 *    gemeldeten Stelle markiert. So kann sich der eigene Parser nicht still von Strudel entfernen.
 */
export function analyze(tokens: readonly Token[]): ParseResult {
  const result = parse(tokens);
  if (result.errors.length > 0 || tokens.length === 0) return result;

  const { text, all } = trackToMiniWithRanges(tokens);
  const verdict = validateMini(text);
  if (verdict.ok) return result;

  const blamed = [...all].reverse().find((r) => r.start <= verdict.offset) ?? all[0];
  result.errors.push({ code: 'strudel-syntax', tokenId: blamed.tokenId, detail: verdict.message });
  result.errorIds.add(blamed.tokenId);
  return result;
}
