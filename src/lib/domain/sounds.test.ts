import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_SOUNDS, QUICK_SOUNDS, SOUND_GROUPS, SOUND_SOURCES, isSoundName, splitVariant, stepVariant } from './sounds.ts';
// @ts-expect-error reines JavaScript ohne Typen
import { prebakeUrls, sourceId, synthSources } from '../../../scripts/strudel-sounds.mjs';

// Ohne Netz: Ob sich der Inhalt der Sample-Listen auf GitHub geändert hat, prüft nur `npm run gen:sounds`.
test('sounds: die erzeugte Liste nutzt dieselben Quellen wie das installierte Prebake (sonst npm run gen:sounds)', () => {
  const urls = SOUND_SOURCES.filter((s) => s.url !== null).map((s) => s.url);
  assert.deepEqual(urls, prebakeUrls());
  assert.deepEqual(
    SOUND_SOURCES.filter((s) => s.url !== null).map((s) => s.id),
    (prebakeUrls() as string[]).map(sourceId),
  );
});

test('sounds: Synths, Rauschen und ZZFX passen zum installierten superdough (sonst npm run gen:sounds)', () => {
  assert.deepEqual(
    SOUND_SOURCES.filter((s) => s.url === null),
    synthSources(),
  );
});

test('sounds: jeder Klang der Palette und der Schnellauswahl ist Strudel bekannt', () => {
  for (const [group, names] of SOUND_GROUPS) {
    assert.ok(names.length > 0, `Gruppe ${group} ist leer`);
    for (const n of names) assert.ok(n === '~' || ALL_SOUNDS.has(n), `${group}: ${n}`);
  }
  for (const n of QUICK_SOUNDS) assert.ok(n === '~' || ALL_SOUNDS.has(n), n);
});

test('sounds: Namen, die Strudel nicht kennt, sind nicht dabei', () => {
  for (const n of ['juno', '808', 'bass', 'arpy', 'noise', 'superpiano']) assert.ok(!ALL_SOUNDS.has(n), n);
  for (const n of ['bd', 'sd', 'hh', 'casio', 'piano', 'white', 'supersaw']) assert.ok(ALL_SOUNDS.has(n), n);
});

test('sounds: getippte Klangnamen, unbekannte und Varianten erlaubt, sonstige Mini-Notation nicht', () => {
  for (const n of ['bd', 'gm_piano', 'rec1', 'AkaiLinn_bd', 'unbekannt', 'bd:3', 'rec1:12']) assert.ok(isSoundName(n), n);
  for (const n of ['', '~', '~:1', 'bd:', 'bd:x', 'bd:1:2', 'bd:-1', 'bd*2', '1bd', 'bd sd', '[bd']) assert.ok(!isSoundName(n), n);
  for (const n of ALL_SOUNDS) assert.ok(isSoundName(n), n);
});

test('sounds: Name und Variante', () => {
  assert.deepEqual(splitVariant('bd:3'), { name: 'bd', variant: 3 });
  assert.deepEqual(splitVariant('bd'), { name: 'bd', variant: 0 });
  assert.deepEqual(splitVariant('gm_piano:0'), { name: 'gm_piano', variant: 0 });
});

test('sounds: −/+ zählen die Variante, nicht unter 0', () => {
  assert.equal(stepVariant('bd', 1), 'bd:1');
  assert.equal(stepVariant('bd:1', 1), 'bd:2');
  assert.equal(stepVariant('bd:2', -1), 'bd:1');
  assert.equal(stepVariant('bd:1', -1), 'bd');
  assert.equal(stepVariant('bd', -1), 'bd');
  assert.equal(stepVariant('bd:0', 1), 'bd:1');
  assert.equal(stepVariant('~', 1), '~');
  assert.equal(stepVariant('bd*2', 1), 'bd*2');
});
