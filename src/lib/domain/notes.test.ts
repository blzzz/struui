import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNote, stepNote } from './notes.ts';

test('notes: Notennamen wie in Strudel, dazu MIDI-Nummern', () => {
  for (const n of ['f', 'C', 'c#4', 'eb3', 'fs2', 'bf', 'a-1', '60', '61.5']) assert.ok(isNote(n), n);
  for (const n of ['', 'h', 'bd', 'c 4', 'sine', '#c']) assert.ok(!isNote(n), n);
});

test('notes: Halbtonschritte, aufwärts mit #, abwärts mit b, Oktave nur wenn nötig', () => {
  assert.equal(stepNote('e', 1), 'f');
  assert.equal(stepNote('f', 1), 'f#');
  assert.equal(stepNote('f', -1), 'e');
  assert.equal(stepNote('e', -1), 'eb');
  assert.equal(stepNote('b', 1), 'c4', 'Oktave 4 muss dastehen');
  assert.equal(stepNote('c', -1), 'b2');
  assert.equal(stepNote('c4', -1), 'b3', 'Oktave bleibt, wenn sie dastand');
  assert.equal(stepNote('c#4', 1), 'd4');
  assert.equal(stepNote('60', 1), '61');
  assert.equal(stepNote('sine', 1), 'sine');
});
