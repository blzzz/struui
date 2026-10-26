import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_STORE, byRecent, patternName, readStore, removePattern, savePattern } from './patterns.ts';
import type { Pattern } from './patterns.ts';

const p = (id: string, updated = 0): Pattern => ({ id, name: id, code: `s("${id}")`, updated });

test('patterns: Lesen verzeiht Fehlendes, Kaputtes und fremde Versionen', () => {
  assert.deepEqual(readStore(null), EMPTY_STORE);
  assert.deepEqual(readStore('{kaputt'), EMPTY_STORE);
  assert.deepEqual(readStore('null'), EMPTY_STORE);
  assert.deepEqual(readStore(JSON.stringify({ version: 2, current: 'a', patterns: [p('a')] })), EMPTY_STORE);
  // Ungültige Einträge fallen weg, ein unbekanntes `current` wird null
  const read = readStore(JSON.stringify({ version: 1, current: 'x', patterns: [p('a'), { id: 'b' }] }));
  assert.deepEqual(read, { version: 1, current: null, patterns: [p('a')] });
  assert.deepEqual(readStore(JSON.stringify(savePattern(EMPTY_STORE, p('a')))).current, 'a');
});

test('patterns: Name mit der nächsten freien Nummer', () => {
  assert.equal(patternName([]), 'Pattern 1');
  assert.equal(patternName(['Pattern 1', 'Pattern 3']), 'Pattern 2');
  assert.equal(patternName(['Beat']), 'Pattern 1');
});

test('patterns: Speichern ersetzt nach ID und macht es aktuell, Entfernen löst das aktuelle', () => {
  let s = savePattern(EMPTY_STORE, p('a'));
  s = savePattern(s, p('b'));
  assert.equal(s.current, 'b');
  s = savePattern(s, { ...p('a'), code: 'neu' });
  assert.deepEqual(s.patterns.map((x) => [x.id, x.code]), [['a', 'neu'], ['b', 's("b")']]);
  assert.equal(s.current, 'a');
  assert.equal(removePattern(s, 'b').current, 'a');
  const r = removePattern(s, 'a');
  assert.equal(r.current, null);
  assert.deepEqual(r.patterns.map((x) => x.id), ['b']);
});

test('patterns: zuletzt gespeichertes zuerst', () => {
  assert.deepEqual(byRecent([p('a', 1), p('b', 3), p('c', 2)]).map((x) => x.id), ['b', 'c', 'a']);
});
