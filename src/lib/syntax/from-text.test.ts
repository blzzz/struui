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
    ['a*2@3 b/2', ['a*2@3', 'b/2']],
    ['[a b]:2 ~:1 bd:<1 2> bd*2:3', ['[a b]:2', '~:1', 'bd:<1 2>', 'bd*2:3']],
    ['[a, b]*2 c', ['[a, b]*2', 'c']],
    ['[a b, c] [a, ~?]', ['[a b, c]', '[a, ~?]']],
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

test('text: Kommagruppe aus einzelnen Klängen wird ein Stapel', () => {
  for (const [input, expected] of [
    ['x [a, b*2?] y', 'x [a, b*2?] y'],
    ['[a,b,c] [d, e]', '[a, b, c] [d, e]'],
    ['<[a, ~] b>', '<[a, ~] b>'],
  ]) {
    const out = roundTrip(input);
    assert.equal(out, expected);
    assert.equal(meaning(out), meaning(input), input);
  }
  const r = textToTokens('x [a, b, c] y');
  assert.ok(r.ok);
  assert.deepEqual(r.tokens.map(label), ['x', 'a', 'b', 'c', 'y']);
  assert.deepEqual(r.tokens.map((t) => t.kind === 'sound' && !!t.joined), [false, false, true, true, false]);
});

test('text: Doppelpunkt am Wort (Variante, Geschwindigkeit) gehört zum Stein', () => {
  for (const [input, expected] of [
    ['bd:3 hh:12*2? [sd:1, cp:2]', 'bd:3 hh:12*2? [sd:1, cp:2]'],
    ['.5:2 0:-1 a:b:c', '.5:2 0:-1 a:b:c'],
  ]) {
    const out = roundTrip(input);
    assert.equal(out, expected);
    assert.equal(meaning(out), meaning(input), input);
  }
  const r = textToTokens('bd:3*2');
  assert.ok(r.ok);
  const [t] = r.tokens;
  assert.ok(t.kind === 'sound' && t.sound === 'bd:3' && t.repeat?.op === '*' && t.repeat.value === 2);
});

test('text: leerer Text ist eine leere Spur, Fehler melden die Stelle', () => {
  assert.deepEqual(textToTokens('  '), { ok: true, tokens: [] });
  const r = textToTokens('bd [sd');
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.offset >= 3);
});
