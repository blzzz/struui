import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angleForPosition, parseModValue, positionForAngle } from './scales.ts';
import { repeatOps, soundToken, closeToken, openToken } from './types.ts';
import { tokenToMini } from './codegen.ts';

test('parseModValue: beliebige Zahlen, je Operator begrenzt', () => {
  assert.equal(parseModValue('*', '3'), 3);
  assert.equal(parseModValue('*', '1.5'), 1.5);
  assert.equal(parseModValue('@', '.25'), 0.25);
  assert.equal(parseModValue('@', '2,5'), 2.5);
  assert.equal(parseModValue('%', ' 7 '), 7);
  assert.equal(parseModValue('?', '0.3'), 0.3);
  assert.equal(parseModValue('!', '5'), 5);
  for (const [op, bad] of [['*', '0'], ['*', '-2'], ['*', 'x'], ['*', ''], ['*', '1e3'], ['*', '1000'], ['@', '0.0001'], ['?', '1'], ['!', '2.5']] as const) {
    assert.equal(parseModValue(op, bad), null, `${op}${bad}`);
  }
});

test('repeatOps: Pause nur Gewicht, Klang und Klammer alle, { und [ keine', () => {
  assert.deepEqual(repeatOps(soundToken('~')), ['@']);
  assert.deepEqual(repeatOps(soundToken('bd')), ['*', '!', '@']);
  assert.deepEqual(repeatOps(closeToken('<')), ['*', '!', '@']);
  assert.deepEqual(repeatOps(closeToken('{')), []);
  assert.deepEqual(repeatOps(openToken('[')), []);
});

test('codegen: Pause schreibt nur das Gewicht', () => {
  assert.equal(tokenToMini(soundToken('~', { repeat: { op: '@', value: 2 } })), '~@2');
  assert.equal(tokenToMini(soundToken('~', { repeat: { op: '@', value: 1 } })), '~');
  assert.equal(tokenToMini(soundToken('~', { repeat: { op: '*', value: 2 }, random: 0.5 })), '~');
});

test('positionForAngle: stufenlos über 270°, unten bleibt der Knopf am Ende, an dem er war', () => {
  assert.equal(positionForAngle(-135, 0.5), 0);
  assert.equal(positionForAngle(0, 0.2), 0.5);
  assert.equal(positionForAngle(135, 0.5), 1);
  assert.equal(positionForAngle(-170, 0.9), 1);
  assert.equal(positionForAngle(170, 0.1), 0);
  assert.equal(angleForPosition(0.5), 0);
  assert.equal(angleForPosition(2), 135);
});
