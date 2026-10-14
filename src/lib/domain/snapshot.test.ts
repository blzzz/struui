import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreTracks, snapshot, snapshotName } from './snapshot.ts';
import { effect, soundToken, track } from './types.ts';
import type { Track } from './types.ts';

test('snapshot: Änderungen nach dem Festhalten treffen ihn nicht', () => {
  const tracks: Track[] = [track([soundToken('bd'), soundToken('sd')], 'drums')];
  tracks[0].effects.push(effect('lpf', [soundToken('800')]));
  const s = snapshot('A', tracks, 0.5, 'code');
  tracks[0].tokens.push(soundToken('hh'));
  tracks[0].effects[0].name = 'hpf';
  assert.equal(s.tracks[0].tokens.length, 2);
  assert.equal(s.tracks[0].effects[0].name, 'lpf');
});

test('snapshot: Laden gibt eine eigene Kopie mit gleichen IDs', () => {
  const tracks: Track[] = [track([soundToken('bd')])];
  const s = snapshot('A', tracks, 0.5, 'code');
  const loaded = restoreTracks(s);
  assert.deepEqual(loaded, s.tracks);
  assert.equal(loaded[0].tokens[0].id, tracks[0].tokens[0].id);
  loaded[0].tokens.length = 0;
  assert.equal(s.tracks[0].tokens.length, 1);
  assert.equal(restoreTracks(s)[0].tokens.length, 1);
});

test('snapshotName: erster freier Standardname', () => {
  assert.equal(snapshotName([]), 'Snapshot 1');
  assert.equal(snapshotName([{ name: 'Snapshot 1' }]), 'Snapshot 2');
  assert.equal(snapshotName([{ name: 'Intro' }, { name: 'Snapshot 3' }]), 'Snapshot 4');
  assert.equal(snapshotName([{ name: 'Snapshot 2' }]), 'Snapshot 3');
});
