import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreTracks, sameContent, scene, sceneName, withContent } from './scene.ts';
import { effect, soundToken, track } from './types.ts';
import type { Track } from './types.ts';

test('scene: Änderungen nach dem Anlegen treffen sie nicht', () => {
  const tracks: Track[] = [track([soundToken('bd'), soundToken('sd')], 'drums')];
  tracks[0].effects.push(effect('lpf', [soundToken('800')]));
  const s = scene('A', tracks, 0.5);
  tracks[0].tokens.push(soundToken('hh'));
  tracks[0].effects[0].name = 'hpf';
  assert.equal(s.tracks[0].tokens.length, 2);
  assert.equal(s.tracks[0].effects[0].name, 'lpf');
});

test('scene: Laden gibt eine eigene Kopie mit gleichen IDs', () => {
  const tracks: Track[] = [track([soundToken('bd')])];
  const s = scene('A', tracks, 0.5);
  const loaded = restoreTracks(s);
  assert.deepEqual(loaded, s.tracks);
  assert.equal(loaded[0].tokens[0].id, tracks[0].tokens[0].id);
  loaded[0].tokens.length = 0;
  assert.equal(s.tracks[0].tokens.length, 1);
  assert.equal(restoreTracks(s)[0].tokens.length, 1);
});

test('withContent: neuer Inhalt als Kopie, Name und ID bleiben', () => {
  const tracks: Track[] = [track([soundToken('bd')])];
  const s = scene('Intro', tracks, 0.5);
  tracks[0].tokens.push(soundToken('sd'));
  const u = withContent(s, tracks, 1);
  assert.equal(u.id, s.id);
  assert.equal(u.name, 'Intro');
  assert.equal(u.cps, 1);
  assert.equal(u.tracks[0].tokens.length, 2);
  tracks[0].tokens.length = 0;
  assert.equal(u.tracks[0].tokens.length, 2);
});

test('sameContent: erkennt Änderungen an Spuren und Tempo', () => {
  const tracks: Track[] = [track([soundToken('bd')])];
  const s = scene('A', tracks, 0.5);
  assert.ok(sameContent(s, tracks, 0.5));
  assert.ok(!sameContent(s, tracks, 0.6));
  tracks[0].muted = true;
  assert.ok(!sameContent(s, tracks, 0.5));
});

test('sceneName: erster freier Standardname', () => {
  assert.equal(sceneName([]), 'Szene01');
  assert.equal(sceneName([{ name: 'Szene01' }]), 'Szene02');
  assert.equal(sceneName([{ name: 'Intro' }, { name: 'Szene03' }]), 'Szene04');
  assert.equal(sceneName([{ name: 'Szene02' }]), 'Szene03');
});
