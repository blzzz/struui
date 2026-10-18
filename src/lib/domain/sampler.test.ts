import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toStrudelProgram, trackToCode } from './codegen.ts';
import { clampSlices, convertValue, samplerInfo, startValues, takesSpeed } from './sampler.ts';
import { closeToken, contentOf, effect, openToken, soundToken } from './types.ts';
import type { Token } from './types.ts';
import { codeToTrack } from '../syntax/from-code.ts';

const sampler = (mode: 'scrub' | 'slice', values: string[], sample = ['brk']) => ({
  type: 'sampler' as const,
  name: 'x',
  tokens: values.map((v) => soundToken(v)),
  sample: { tokens: sample.map((s): Token => soundToken(s)) },
  samplerMode: mode,
  slices: 8,
});

test('sampler: Sample in s(), Wertsteine in slice oder scrub, danach Effekte', () => {
  assert.equal(trackToCode(sampler('slice', ['0', '3'])).text, '/* x */ s("brk").slice(8, "0 3")');
  assert.equal(trackToCode({ ...sampler('slice', ['5']), slices: 16 }).text, '/* x */ s("brk").slice(16, "5")', 'auch ein Stein in Anführungszeichen');
  assert.equal(trackToCode(sampler('scrub', ['0', '.25'])).text, '/* x */ s("brk").scrub("0 .25")');
  assert.equal(trackToCode(sampler('scrub', ['.5'])).text, '/* x */ s("brk").scrub(0.5)');
  const t = { ...sampler('slice', ['0']), effects: [effect('lpf', [soundToken('800')])], orbit: 2 };
  assert.equal(trackToCode(t).text, '/* x */ s("brk").slice(8, "0").lpf(800).orbit(2)');
});

test('sampler: Positionen von Sample- und Wertsteinen zeigen in den Code', () => {
  const t = sampler('slice', ['0', '3'], ['brk', 'amen']);
  t.sample.tokens.unshift(openToken('<'));
  t.sample.tokens.push(closeToken('<'));
  const { code, ranges } = toStrudelProgram([t], { cps: 1 });
  for (const token of [...t.sample.tokens, ...t.tokens]) {
    if (token.kind !== 'sound') continue;
    const r = ranges.find((x) => x.tokenId === token.id);
    assert.ok(r, token.sound);
    assert.equal(code.slice(r.start, r.end), token.sound);
  }
});

test('sampler: ohne Sample oder ohne Wertsteine nicht im Code', () => {
  assert.doesNotMatch(toStrudelProgram([sampler('slice', ['0'], [])], { cps: 1 }).code, /\/\* x \*\//);
  assert.doesNotMatch(toStrudelProgram([sampler('slice', [])], { cps: 1 }).code, /\/\* x \*\//);
});

test('sampler: Rückweg aus Code, slice immer, scrub nur wenn die Spur schon eine Sampler-Spur ist', () => {
  const r = codeToTrack('/* x */ s("<brk amen>").slice(16, "0 <3 7>").lpf(800)');
  assert.ok(r.ok);
  assert.equal(r.type, 'sampler');
  assert.equal(r.samplerMode, 'slice');
  assert.equal(r.slices, 16);
  assert.equal(r.effects[0].name, 'lpf');
  assert.equal(trackToCode(r).text, '/* x */ s("<brk amen>").slice(16, "0 <3 7>").lpf(800)');

  const scrub = '/* x */ s("brk").scrub("0 .5")';
  const asSound = codeToTrack(scrub);
  assert.ok(asSound.ok);
  assert.equal(asSound.type, 'sound', 'scrub in einer Klangspur bleibt ein Effekt');
  assert.equal(asSound.effects[0].name, 'scrub');
  const asSampler = codeToTrack(scrub, 'sampler');
  assert.ok(asSampler.ok);
  assert.equal(asSampler.type, 'sampler');
  assert.equal(asSampler.samplerMode, 'scrub');
  assert.equal(trackToCode(asSampler).text, scrub);
  // In einer Sampler-Spur ist nur das erste scrub die Art, weitere sind Effekte
  const twice = codeToTrack('/* x */ s("brk").scrub(".5").scrub(".2")', 'sampler');
  assert.ok(twice.ok && twice.type === 'sampler' && twice.effects[0].name === 'scrub');
});

test('sampler: Fehler im Code nennen die Stelle', () => {
  const at = (code: string) => {
    const r = codeToTrack(code, 'sampler');
    assert.ok(!r.ok, code);
    return r.offset;
  };
  assert.equal(at('/* x */ s("brk").slice(0, "0")'), 23, 'mindestens ein Abschnitt');
  assert.equal(at('/* x */ s("brk").slice("0")'), 23, 'Zahl der Abschnitte fehlt');
  assert.equal(at('/* x */ s("brk").slice(8 "0")'), 25, 'Komma fehlt');
  assert.equal(at('/* x */ s("brk").slice(8, "0").midi()'), 17, 'nicht mit MIDI');
  assert.equal(at('/* x */ s("brk").scrub(slider(.5))'), 17, 'kein Regler');
});

test('sampler: Werte von slice sind die Abschnittsnummern, scrub nimmt Strudels Beispiele', () => {
  assert.deepEqual(samplerInfo('slice', 4).values, ['0', '1', '2', '3']);
  assert.ok(samplerInfo('slice', 4).description.length > 0);
  assert.ok(samplerInfo('scrub', 8).values.length > 0);
  assert.deepEqual(startValues('slice'), ['0', '1', '2', '3']);
  assert.equal(clampSlices(0), 1);
  assert.equal(clampSlices(7.6), 8);
  assert.equal(clampSlices(1000), 64);
  assert.equal(contentOf('sampler'), 'values');
});

test('sampler: beim Wechsel der Art umgerechnet, die Geschwindigkeit bleibt nur bei scrub', () => {
  assert.ok(takesSpeed('scrub') && !takesSpeed('slice'));
  assert.equal(convertValue('2', 'scrub', 8), '0.25');
  assert.equal(convertValue('.25', 'slice', 8), '2');
  assert.equal(convertValue('.99', 'slice', 8), '7');
  assert.equal(convertValue('.5:2', 'slice', 8), '4');
  assert.equal(convertValue('4:2', 'scrub', 8), '0.5:2');
  assert.equal(convertValue('a', 'slice', 8), 'a');
  assert.equal(convertValue('~', 'scrub', 8), '~');
});

test('sampler: scrub mit Geschwindigkeit steht als Mini-Notation im Code', () => {
  assert.equal(trackToCode(sampler('scrub', ['.5:2'])).text, '/* x */ s("brk").scrub(".5:2")');
});
