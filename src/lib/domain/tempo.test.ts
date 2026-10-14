import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpsToUnit, tempoCode, unitToCps } from './tempo.ts';
import { toStrudelCode } from './codegen.ts';
import { soundToken } from './types.ts';

test('tempo: 0.5 cps sind 30 CPM und 120 BPM', () => {
  assert.equal(cpsToUnit(0.5, 'cps'), 0.5);
  assert.equal(cpsToUnit(0.5, 'cpm'), 30);
  assert.equal(cpsToUnit(0.5, 'bpm'), 120);
});

test('tempo: Hin und zurück ohne Gleitkomma-Reste', () => {
  for (const bpm of [60, 99, 125, 133, 174]) assert.equal(cpsToUnit(unitToCps(bpm, 'bpm'), 'bpm'), bpm);
  assert.equal(cpsToUnit(unitToCps(37.5, 'cpm'), 'cpm'), 37.5);
});

test('tempo: Code in der gewählten Einheit', () => {
  assert.equal(tempoCode(unitToCps(125, 'bpm'), 'bpm'), 'setcpm(125/4)');
  assert.equal(tempoCode(0.5, 'cpm'), 'setcpm(30)');
  assert.equal(tempoCode(0.5, 'cps'), 'setcps(0.5)');
});

test('tempo: codegen schreibt die Einheit, ohne Angabe setcps', () => {
  const tracks = [{ tokens: [soundToken('bd')] }];
  assert.match(toStrudelCode(tracks, { cps: 0.5, tempoUnit: 'bpm' }), /^setcpm\(120\/4\)\n/);
  assert.match(toStrudelCode(tracks, { cps: 0.5 }), /^setcps\(0\.5\)\n/);
});
