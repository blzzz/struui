import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNDO_GAP, UNDO_MAX, UndoLog } from './undo.ts';

test('UndoLog: Schritt für Schritt zurück bis zum Anfang', () => {
  const log = new UndoLog('a', 'a');
  log.record('b', 'b', 0);
  log.record('c', 'c', UNDO_GAP + 1);
  assert.equal(log.depth, 2);
  assert.equal(log.undo(), 'b');
  assert.equal(log.undo(), 'a');
  assert.equal(log.undo(), null);
});

test('UndoLog: schnelle Folge ist ein Schritt, gleicher Zustand keiner', () => {
  const log = new UndoLog(1, '1');
  log.record(2, '2', 1000);
  log.record(3, '3', 1100);
  log.record(3, '3', 5000);
  // Gemessen ab der letzten echten Änderung (1100), nicht ab dem Anfang der Folge
  log.record(4, '4', 1100 + UNDO_GAP);
  assert.equal(log.depth, 1);
  assert.equal(log.undo(), 1);
});

test('UndoLog: nach undo beginnt die nächste Änderung einen neuen Schritt', () => {
  const log = new UndoLog('a', 'a');
  log.record('b', 'b', 0);
  log.record('c', 'c', 1000);
  assert.equal(log.undo(), 'b');
  // Gleich danach, trotzdem eigener Schritt
  log.record('x', 'x', 1001);
  assert.equal(log.undo(), 'b');
  assert.equal(log.undo(), 'a');
});

test('UndoLog: hält höchstens UNDO_MAX Schritte', () => {
  const log = new UndoLog(0, '0');
  for (let i = 1; i <= UNDO_MAX + 5; i++) log.record(i, String(i), i * (UNDO_GAP + 1));
  assert.equal(log.depth, UNDO_MAX);
  let s: number | null = null;
  while (log.depth) s = log.undo();
  assert.equal(s, 5);
});
