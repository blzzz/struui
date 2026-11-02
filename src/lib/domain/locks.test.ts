import { test } from 'node:test';
import assert from 'node:assert/strict';
import { locksToCode, trackToCode } from './codegen.ts';
import {
  addLockParam,
  browseLockParams,
  isLockParam,
  isLockValue,
  joinLockParts,
  lockDefault,
  lockParams,
  lockParts,
  locks,
  removeLockParam,
  renameLockParam,
  setLockPart,
} from './locks.ts';
import { closeToken, openToken, soundToken } from './types.ts';
import type { Token } from './types.ts';

const values = (tokens: readonly Token[]) => tokens.map((t) => (t.kind === 'sound' ? t.sound : t.kind));

test('locks: Teile lesen und wieder zusammensetzen, leer nur hinten', () => {
  assert.deepEqual(lockParts('1:4', 3), ['1', '4', '']);
  assert.deepEqual(lockParts('1', 1), ['1']);
  assert.equal(joinLockParts(['1', '4', '']), '1:4');
  assert.equal(joinLockParts(['1', '', '']), '1');
  // Strudel kennt keinen leeren Teil in der Mitte (~:4 macht den ganzen Schritt still)
  assert.equal(joinLockParts(['', '4']), null);
  assert.equal(joinLockParts(['', '']), null);
});

test('locks: Teil setzen füllt leere Teile davor mit Startwerten, leeren geht nur hinten', () => {
  const params = ['velocity', 'n', 's'];
  assert.equal(setLockPart('1', 2, 'sd', params), `1:${lockDefault('n')}:sd`);
  assert.equal(setLockPart('1:4:sd', 2, '', params), '1:4');
  assert.equal(setLockPart('1:4:sd', 1, '', params), null);
  assert.equal(setLockPart('1', 0, '', params), null);
  assert.equal(setLockPart('1:4', 0, '.5', params), '.5:4');
});

test('locks: gültige Werte haben höchstens so viele Teile wie Parameter', () => {
  assert.ok(isLockValue('1', 1));
  assert.ok(isLockValue('.7:4:sd', 3));
  assert.ok(!isLockValue('.7:4:sd', 2));
  assert.ok(!isLockValue('~', 1));
  assert.ok(!isLockValue('1::sd', 3));
});

test('locks: sperrbar sind n, s und Effekte mit einem Wert, keine Musterbefehle', () => {
  for (const p of ['n', 's', 'velocity', 'room', 'lpf', 'gain', 'note']) assert.ok(isLockParam(p), p);
  for (const p of ['fast', 'rev', 'struct', 'fit', 'up', 'unbekannt']) assert.ok(!isLockParam(p), p);
  const all = lockParams();
  assert.deepEqual(all.slice(0, 2), ['n', 's']);
  assert.ok(all.includes('velocity'));
  assert.equal(new Set(all).size, all.length);
});

test('locks: Parameter in der Effektsuche, ohne die schon gesperrten, n und s unter Sample', () => {
  const names = (q: string, c: Parameters<typeof browseLockParams>[1], ex: string[] = []) =>
    browseLockParams(q, c, ex).map((i) => i.name);
  assert.deepEqual(names('', null).slice(0, 2), ['n', 's']);
  assert.ok(!names('', null, ['n', 'velocity']).includes('velocity'));
  assert.ok(!names('', null, ['n']).includes('n'));
  assert.deepEqual(names('', 'sample').slice(0, 2), ['n', 's']);
  assert.equal(names('lpf', null)[0], 'lpf');
  assert.ok(names('', 'filter').includes('lpf'));
  assert.ok(!names('', null).includes('fast'));
});

test('locks: Parameter anfügen, ersetzen und entfernen (samt Teil in jedem Wert)', () => {
  const l = locks(['velocity', 'n'], [soundToken('1:4'), soundToken('~'), openToken('['), soundToken('.5'), closeToken('[')]);
  addLockParam(l, 's');
  assert.deepEqual(l.params, ['velocity', 'n', 's']);
  renameLockParam(l, 2, 'room');
  assert.deepEqual(l.params, ['velocity', 'n', 'room']);
  removeLockParam(l, 0);
  assert.deepEqual(l.params, ['n', 'room']);
  // .5 hatte nur velocity: der Wert wird zum Startwert von n; Pause und Klammern bleiben
  assert.deepEqual(values(l.tokens), ['4', '~', 'open', lockDefault('n'), 'close']);
  removeLockParam(l, 0);
  assert.deepEqual(l.params, ['room']);
  removeLockParam(l, 0);
  assert.deepEqual(l.params, [], 'ohne Parameter keine Paramlocks');
  assert.deepEqual(l.tokens, [], 'die Werte gehen mit');
});

test('locks: neue Spuren haben keine Paramlocks, der erste Parameter schaltet sie ein', () => {
  const l = locks();
  assert.deepEqual(l.params, []);
  addLockParam(l, 'lpf');
  assert.deepEqual(l.params, ['lpf']);
  assert.deepEqual(l.tokens, []);
});

test('locks: im Code nach den Effekten als up(…as(…)), Werte leuchten', () => {
  const l = locks(['velocity', 'n'], [soundToken('1'), soundToken('~'), soundToken('.7:4')]);
  const code = locksToCode(l);
  assert.equal(code?.text, '.up("1 ~ .7:4".as("velocity:n"))');
  assert.equal(locksToCode(locks()), null, 'ohne Steine nicht im Code');
  const line = trackToCode({ tokens: [soundToken('bd')], effects: [{ name: 'room', tokens: [soundToken('.2')] }], locks: l, volume: 0.5 });
  assert.equal(line.text, 's("bd").room(0.2).up("1 ~ .7:4".as("velocity:n")).postgain(0.5)');
  const lit = line.ranges.map((r) => line.text.slice(r.start, r.end));
  assert.deepEqual(lit, ['bd', '1', '.7:4']);
  // Nur Klangspuren
  assert.equal(trackToCode({ type: 'midi', tokens: [soundToken('bd')], locks: l }).text, 's("bd").midichan(1).midi()');
});
