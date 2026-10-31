import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SCALE,
  SCALE_ROOTS,
  SCALE_TYPES,
  convertPitches,
  degreeToNote,
  isDegree,
  noteToDegree,
  parseScaleName,
  scaleName,
  stepDegree,
} from './pitch.ts';
import { soundToken, openToken, closeToken } from './types.ts';

const C4_MAJOR = DEFAULT_SCALE;
const A3_MINOR = { root: 'A', octave: 3, type: 'minor' };

test('Tonleiter: Name im Code und zurück, ohne Oktave 3 wie in Strudel', () => {
  assert.equal(scaleName(C4_MAJOR), 'C4:major');
  assert.deepEqual(parseScaleName('C4:major'), C4_MAJOR);
  assert.deepEqual(parseScaleName('Bb:dorian'), { root: 'Bb', octave: 3, type: 'dorian' });
  assert.deepEqual(parseScaleName('f#2:major:pentatonic'), { root: 'F#', octave: 2, type: 'major:pentatonic' });
  assert.equal(parseScaleName('C4:gibtsnicht'), null);
  assert.equal(parseScaleName('H:major'), null);
  assert.equal(parseScaleName('major'), null);
  assert.ok(SCALE_ROOTS.includes('C') && SCALE_TYPES.includes('major'));
});

test('Stufen: ganze Zahlen mit Vorzeichen, ↑/↓ zählt um 1', () => {
  for (const ok of ['0', '7', '-3', '0#', '2b', '-1##']) assert.ok(isDegree(ok), ok);
  for (const bad of ['c', '1.5', '', '#1', 'x']) assert.ok(!isDegree(bad), bad);
  assert.equal(stepDegree('0', 1), '1');
  assert.equal(stepDegree('0', -1), '-1');
  assert.equal(stepDegree('2#', 1), '3#');
  assert.equal(stepDegree('c', 1), 'c');
});

test('Stufe zu Note wie Strudels scale: Runden durch die Tonleiter, negative, Vorzeichen', () => {
  assert.equal(degreeToNote('0', C4_MAJOR), 'c4');
  assert.equal(degreeToNote('2', C4_MAJOR), 'e4');
  assert.equal(degreeToNote('7', C4_MAJOR), 'c5');
  assert.equal(degreeToNote('-1', C4_MAJOR), 'b3');
  assert.equal(degreeToNote('0#', C4_MAJOR), 'c#4');
  assert.equal(degreeToNote('2', A3_MINOR), 'c4');
  assert.equal(degreeToNote('1', { root: 'Bb', octave: 3, type: 'major' }), 'c4');
  assert.equal(degreeToNote('2', { root: 'Eb', octave: 3, type: 'major' }), 'g3');
  assert.equal(degreeToNote('c', C4_MAJOR), null);
  // Schreibweise: Moll und Grundtöne mit b erniedrigt, sonst erhöht
  assert.equal(degreeToNote('2', { root: 'C', octave: 4, type: 'minor' }), 'eb4');
  assert.equal(degreeToNote('3', { root: 'F#', octave: 3, type: 'minor' }), 'b3');
  assert.equal(degreeToNote('3', { root: 'C', octave: 4, type: 'lydian' }), 'f#4');
});

test('Note zu Stufe ohne Verlust: zwischen zwei Stufen die tiefere mit #', () => {
  assert.equal(noteToDegree('c4', C4_MAJOR), '0');
  assert.equal(noteToDegree('e4', C4_MAJOR), '2');
  assert.equal(noteToDegree('c', C4_MAJOR), '-7');
  assert.equal(noteToDegree('b3', C4_MAJOR), '-1');
  assert.equal(noteToDegree('c#4', C4_MAJOR), '0#');
  assert.equal(noteToDegree('60', C4_MAJOR), '0');
  assert.equal(noteToDegree('bd', C4_MAJOR), null);
  // Hin und zurück ergibt dieselbe Tonhöhe, in jeder Tonleiter
  for (const type of ['major', 'minor:pentatonic', 'chromatic', 'whole:tone']) {
    const s = { root: 'Eb', octave: 3, type };
    for (const note of ['c3', 'db3', 'e3', 'g#4', 'b2', 'f5']) {
      const back = degreeToNote(noteToDegree(note, s)!, s)!;
      assert.equal(midi(back), midi(note), `${note} in ${type}`);
    }
  }
});

test('convertPitches: rechnet Notensteine um, Pausen, Klammern und Unbekanntes bleiben', () => {
  const tokens = [soundToken('c4', { random: 0.5 }), soundToken('~'), openToken('['), soundToken('e4'), soundToken('x'), closeToken('[')];
  const rel = convertPitches(tokens, 'relative', C4_MAJOR);
  assert.deepEqual(rel.map((t) => (t.kind === 'sound' ? t.sound : t.kind)), ['0', '~', 'open', '2', 'x', 'close']);
  assert.equal(rel[0].id, tokens[0].id);
  assert.equal(rel[0].kind === 'sound' && rel[0].random, 0.5);
  const abs = convertPitches(rel, 'absolute', C4_MAJOR);
  assert.deepEqual(abs.map((t) => (t.kind === 'sound' ? t.sound : t.kind)), ['c4', '~', 'open', 'e4', 'x', 'close']);
});

function midi(name: string): number {
  const m = /^([a-g])([#b]*)(-?\d+)$/.exec(name)!;
  const pc = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1]]!;
  return (Number(m[3]) + 1) * 12 + pc + [...m[2]].reduce((s, c) => s + (c === '#' ? 1 : -1), 0);
}
