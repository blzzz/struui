import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampTimes, insertSection, moveSection, positionAt, sceneVariables, section } from './arrangement.ts';
import type { Section } from './arrangement.ts';
import { toArrangedProgram, toStrudelProgram } from './codegen.ts';
import { soundToken } from './types.ts';

test('sceneVariables: gültige, verschiedene Namen nah am Szenennamen', () => {
  assert.deepEqual(sceneVariables(['Szene01', 'Intro Teil', '2. Strophe', 'Szene01', 's', 'const', '']), [
    'Szene01',
    'Intro_Teil',
    '_2_Strophe',
    'Szene01_2',
    's_',
    'const_',
    'Szene',
  ]);
  assert.deepEqual(sceneVariables(['Grüezi', 'a-b']), ['Grüezi', 'a_b']);
});

test('clampTimes: ganze Zahl zwischen 1 und 16', () => {
  assert.equal(clampTimes(0), 1);
  assert.equal(clampTimes(2.6), 3);
  assert.equal(clampTimes(500), 16);
  assert.equal(clampTimes(Number.NaN), 1);
});

test('insertSection und moveSection: Positionen wie beim Ablegen', () => {
  const ids = (l: Section[]) => l.map((s) => s.sceneId).join('');
  const list: Section[] = [];
  insertSection(list, 0, section('a'));
  insertSection(list, 1, section('b'));
  insertSection(list, 9, section('c'));
  assert.equal(ids(list), 'abc');
  moveSection(list, list[0].id, 3);
  assert.equal(ids(list), 'bca');
  moveSection(list, list[2].id, 0);
  assert.equal(ids(list), 'abc');
  moveSection(list, list[1].id, 1);
  assert.equal(ids(list), 'abc', 'an die eigene Stelle');
});

test('toArrangedProgram: Szenen als Variablen, dann arrange', () => {
  const bd = soundToken('bd');
  const hh = soundToken('hh');
  const { code, ranges } = toArrangedProgram(
    [
      { id: 'x', variable: 'Szene01', tracks: [{ tokens: [bd] }] },
      { id: 'y', variable: 'Szene02', tracks: [{ tokens: [hh] }] },
      { id: 'z', variable: 'Leer', tracks: [{ tokens: [] }] },
    ],
    [
      { sceneId: 'x', times: 4 },
      { sceneId: 'y', times: 2 },
      { sceneId: 'weg', times: 1 },
    ],
    { cps: 0.5, lit: 'y' },
  );
  assert.equal(
    code,
    'setcps(0.5)\n' +
      '\nconst Szene01 = stack(\n  s("bd")\n)\n' +
      '\nconst Szene02 = stack(\n  s("hh")\n)\n' +
      '\nconst Leer = silence\n' +
      '\narrange(\n  [4, Szene01],\n  [2, Szene02]\n)',
  );
  assert.equal(ranges.length, 1, 'nur die angezeigte Szene leuchtet');
  assert.equal(code.slice(ranges[0].start, ranges[0].end), 'hh');
  assert.equal(ranges[0].tokenId, hh.id);
});

test('toArrangedProgram: ohne Abschnitt silence', () => {
  const { code } = toArrangedProgram([{ id: 'x', variable: 'A', tracks: [] }], [], { cps: 1 });
  assert.ok(code.endsWith('\nsilence'));
});

test('toStrudelProgram: Positionen nach dem Umbau unverändert', () => {
  const t = soundToken('sd');
  const { code, ranges } = toStrudelProgram([{ tokens: [soundToken('bd'), t] }], { cps: 0.5 });
  assert.equal(code, 'setcps(0.5)\n\nstack(\n  s("bd sd")\n)');
  assert.equal(code.slice(ranges[1].start, ranges[1].end), 'sd');
});

test('positionAt: Abschnitt und Fortschritt, danach von vorn', () => {
  const list = [
    { id: 'a', times: 2 },
    { id: 'b', times: 1 },
  ];
  assert.deepEqual(positionAt(list, 0), { sectionId: 'a', progress: 0 });
  assert.deepEqual(positionAt(list, 1.5), { sectionId: 'a', progress: 0.5 });
  assert.equal(positionAt(list, 2.2)?.sectionId, 'b');
  assert.deepEqual(positionAt(list, 3), { sectionId: 'a', progress: 0 });
  assert.equal(positionAt([], 1), null);
});
