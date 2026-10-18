import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrangeTracks, matchTracks } from './program.ts';
import { inCode, toStrudelProgram, trackToCode } from './codegen.ts';
import { soundToken } from './types.ts';

const old = (...names: (string | [string, false])[]) =>
  names.map((n) => (typeof n === 'string' ? { name: n, shown: true } : { name: n[0], shown: false }));

test('program: Zeilen übernehmen die Spur mit gleichem Namen, auch an anderer Stelle', () => {
  assert.deepEqual(matchTracks(old('drums', 'bass'), ['bass', 'drums']), [1, 0]);
  assert.deepEqual(matchTracks(old('drums', 'bass'), ['drums', 'neu', 'bass']), [0, null, 1]);
});

test('program: ohne passenden Namen nach Stelle, aber nie eine Spur, deren Name noch vorkommt', () => {
  // Umbenannt: die Zeile an Stelle 0 übernimmt die Spur an Stelle 0
  assert.deepEqual(matchTracks(old('drums', 'bass'), ['kick', 'bass']), [0, 1]);
  // Ohne Namen in der Zeile ebenso
  assert.deepEqual(matchTracks(old('a', 'b'), ['', '']), [0, 1]);
  // Stelle 0 gehört «drums», das weiter hinten steht: keine Übernahme nach Stelle
  assert.deepEqual(matchTracks(old('drums', 'bass'), ['neu', 'drums']), [null, 0]);
  // Gleiche Namen: jede Spur nur einmal
  assert.deepEqual(matchTracks(old('a', 'a'), ['a', 'a', 'a']), [0, 1, null]);
});

test('program: Spuren, die nicht im Code standen, zählen nicht mit und bleiben am Ende', () => {
  const tracks = old('drums', ['leer', false], 'bass');
  const match = matchTracks(tracks, ['', 'bass']);
  assert.deepEqual(match, [0, 2]);
  assert.deepEqual(arrangeTracks(tracks, match), [0, 2, 1]);
  // Weggefallene Zeile: «bass» fehlt im Ergebnis, die leere Spur bleibt
  assert.deepEqual(arrangeTracks(tracks, matchTracks(tracks, ['drums'])), [0, 1]);
});

test('codegen: roher Code steht unverändert im Stapel, mit Name und .hush()', () => {
  assert.equal(trackToCode({ tokens: [], code: 'n("0 2").scale("C:minor")', name: 'x' }).text, '/* x */ n("0 2").scale("C:minor")');
  assert.equal(trackToCode({ tokens: [], code: 'arrange([4, a])', muted: true }).text, 'arrange([4, a]).hush()');
  assert.equal(inCode({ tokens: [], code: '  ' }), false);
  assert.equal(inCode({ tokens: [], code: 'a' }), true);
});

test('codegen: Rahmen um den Stapel, Positionen zählen ab dem Stapel', () => {
  const frame = { before: 'const a = 1', chain: '.fast(2)', after: ';\n// Ende' };
  const p = toStrudelProgram([{ tokens: [soundToken('bd')] }], { cps: 0.5, frame });
  assert.equal(p.code, 'setcps(0.5)\n\nconst a = 1\n\nstack(\n  s("bd")\n).fast(2);\n// Ende');
  assert.equal(p.code.slice(p.ranges[0].start, p.ranges[0].end), 'bd');
  // Ohne Spuren hängen die Aufrufe an silence
  assert.equal(toStrudelProgram([], { cps: 0.5, frame }).code, 'setcps(0.5)\n\nconst a = 1\n\nsilence.fast(2);\n// Ende');
});

test('codegen: Aufnahmen auch für rohen Code, wenn ihr Name als Wort darin steht', () => {
  const samples = new Map([['rec1', 'data:audio/wav;base64,AA']]);
  const code = (raw: string) => toStrudelProgram([{ tokens: [], code: raw }], { cps: 0.5, samples }).code;
  assert.match(code('s("rec1 bd")'), /samples\(\{\n  rec1:/);
  assert.match(code('s("rec1:2")'), /samples/);
  assert.doesNotMatch(code('s("rec10")'), /samples/);
});
