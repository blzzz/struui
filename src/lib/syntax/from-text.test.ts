import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse as krillParse } from '@strudel/mini/krill-parser.js';
import { trackToMini } from '../domain/codegen.ts';
import { label } from '../domain/types.ts';
import { textToTokens } from './from-text.ts';

/** Syntaxbaum ohne Positionen: so versteht Strudel den Text. */
function meaning(text: string): string {
  return JSON.stringify(krillParse(`"${text}"`), (k, v) => (k === 'location_' ? undefined : v));
}

function roundTrip(text: string): string {
  const r = textToTokens(text);
  assert.ok(r.ok, `${text} ist gültig`);
  return trackToMini(r.tokens);
}

test('text: unterstützte Notation wird zu Steinen und bedeutet danach dasselbe', () => {
  const cases: [string, string][] = [
    ['bd  hh*2   sd', 'bd hh*2 sd'],
    ['[bd sd]*2?0.3 ~ <a b>', '[bd sd]*2?0.3 ~ <a b>'],
    ['a! b?', 'a!2 b?'],
    ['<a [b c]>!3', '<a [b c]>!3'],
    ['a*0.5', 'a*0.5'],
    ['a@3 [b c]@0.5?', 'a@3 [b c]@0.5?'],
    ['a _ b', 'a@2 b'],
    ['{a b c}%4 {a [b c]}', '{a b c}%4 {a [b c]}'],
  ];
  for (const [input, expected] of cases) {
    const out = roundTrip(input);
    assert.equal(out, expected);
    assert.equal(meaning(out), meaning(input), input);
  }
  const r = textToTokens('[bd sd]*2? hh');
  assert.ok(r.ok);
  assert.deepEqual(r.tokens.map((t) => t.kind), ['open', 'sound', 'sound', 'close', 'sound']);
  const p = textToTokens('{a b}%5');
  assert.ok(p.ok);
  const close = p.tokens[3];
  assert.ok(close.kind === 'close' && close.group === '{' && close.steps === 5);
});

test('text: unbekannte Notation wird ein roher Stein mit dem Originaltext', () => {
  const cases: [string, string[]][] = [
    ['bd(3,8) hh', ['bd(3,8)', 'hh']],
    ['bd:3 a*2@3 b/2', ['bd:3', 'a*2@3', 'b/2']],
    ['[a, b] c', ['[a, b]', 'c']],
    ['[x <a, b>] {a b, c}', ['[', 'x', '<a, b>', ']', '{a b, c}']],
    ['{a b}*2 {a b}%<2 3>', ['{a b}*2', '{a b}%<2 3>']],
    ['a?*2 ~*2', ['a?*2', '~*2']],
    ['a, b', ['a, b']],
  ];
  for (const [input, labels] of cases) {
    const r = textToTokens(input);
    assert.ok(r.ok, input);
    assert.deepEqual(
      r.tokens.map(label),
      labels,
      input,
    );
    assert.equal(meaning(trackToMini(r.tokens)), meaning(input), input);
  }
});

test('text: leerer Text ist eine leere Spur, Fehler melden die Stelle', () => {
  assert.deepEqual(textToTokens('  '), { ok: true, tokens: [] });
  const r = textToTokens('bd [sd');
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.offset >= 3);
});
