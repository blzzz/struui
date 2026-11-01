import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EFFECTS,
  browseEffects,
  categoryOf,
  NOTE_OPS,
  defaultValue,
  effectInfo,
  fromRange,
  fromSlider,
  convertLfoDepth,
  isLfoSeries,
  LFO_DEFAULTS,
  isModSeries,
  isRandSeries,
  isSliderRange,
  sliderStep,
  suggestLfoSeries,
  suggestModSeries,
  suggestRandSeries,
  suggestSliderRange,
  wholeValues,
  isValueAtom,
  noteOpInfo,
  searchEffects,
  searchNoteOps,
  singleValue,
  splitParts,
  stepValue,
  toRange,
  toSlider,
  valueInfo,
  valueScale,
} from './effects.ts';
import { effectToCode, lfoToCode, modToCode, randToCode, toStrudelCode, toStrudelProgram, trackToCode } from './codegen.ts';
import { quickSwitch } from './edit.ts';
import { closeToken, effect, nextInCycle, openToken, soundToken, trackName } from './types.ts';
import type { TrackType } from './types.ts';
// @ts-expect-error reines JavaScript ohne Typen
import { OUTPUT, extractEffects, extractNoteOps, extractSamplerModes, extractScaleSteps, renderModule } from '../../../scripts/strudel-effects.mjs';

test('effects: die erzeugte Liste passt zum installierten Strudel (sonst npm run gen:effects)', () => {
  assert.equal(readFileSync(OUTPUT, 'utf8'), renderModule(extractEffects(), extractNoteOps(), extractSamplerModes(), extractScaleSteps()));
});

test('effects: übliche Effekte sind dabei, Klangwahl und MIDI nicht', () => {
  const names = new Set(EFFECTS.map((e) => e.name));
  for (const n of ['lpf', 'hpf', 'room', 'delay', 'gain', 'pan', 'crush', 'vowel', 'speed']) assert.ok(names.has(n), n);
  for (const n of ['s', 'n', 'bank', 'orbit', 'midichan', 'midiport', 'env', 'postgain']) assert.ok(!names.has(n), n);
});

test('effects: Gruppen, Klangspuren bieten Audio und Tonhöhe, MIDI-Spuren MIDI, Tonhöhe und Anschlag', () => {
  assert.equal(effectInfo('lpf')?.group, 'audio');
  assert.equal(effectInfo('note')?.group, 'pitch');
  for (const n of ['ccn', 'ccv', 'progNum', 'midibend', 'nrpv']) assert.equal(effectInfo(n)?.group, 'midi', n);
  const names = (type: TrackType) => new Set(searchEffects('', type, 1000).map((e) => e.name));
  const sound = names('sound');
  const midi = names('midi');
  for (const n of ['lpf', 'room', 'note', 'velocity']) assert.ok(sound.has(n), n);
  assert.ok(!sound.has('ccv'));
  for (const n of ['ccv', 'progNum', 'note', 'velocity', 'gain']) assert.ok(midi.has(n), n);
  assert.ok(!midi.has('lpf'));
  assert.deepEqual(searchEffects('lpf', 'midi'), []);
  const note = names('note');
  assert.ok(note.has('lpf') && note.has('room'));
  assert.ok(!note.has('note'), 'die Tonhöhe tragen die Steine');
  assert.ok(!note.has('ccv'));
});

test('effects: Werte aus Strudels Beispielen, Zahlen aufsteigend, ohne Zusatzparameter nach «:»', () => {
  assert.deepEqual(effectInfo('vowel')?.values, ['a', 'e', 'i', 'o', 'u']);
  const lpf = effectInfo('lpf')?.values ?? [];
  assert.ok(lpf.length > 2);
  assert.deepEqual([...lpf].map(Number), [...lpf].map(Number).sort((a, b) => a - b));
  assert.ok(!lpf.includes('30'), '1000:30 ist Frequenz:Resonanz');
  assert.equal(effectInfo('cutoff')?.name, 'lpf', 'Synonym');
  assert.equal(defaultValue({ name: 'x', group: 'audio', synonyms: [], description: '', hint: '', values: ['0', '1', '2'] }), '1');
});

test('effects: Suche bevorzugt Namensanfang, findet Synonyme', () => {
  assert.equal(searchEffects('ro')[0].name, 'room');
  assert.equal(searchEffects('lpf')[0].name, 'lpf');
  assert.ok(searchEffects('cutoff').some((e) => e.name === 'lpf'));
  assert.deepEqual(searchEffects('zzzz'), []);
});

test('effects: ein Wert ist eine Zahl oder ein Name', () => {
  for (const v of ['800', '-1', '.5', '0.25', 'a', 'sine', 'ladder']) assert.ok(isValueAtom(v), v);
  for (const v of ['', '1 2', '<1 2>', '"a"', '1.2.3x', '.5:2']) assert.ok(!isValueAtom(v), v);
});

test('effects: als Liste auch mit Doppelpunkt (`scrub`)', () => {
  for (const v of ['.5', '.5:2', '0:-1', 'a:b:c']) assert.ok(isValueAtom(v, true), v);
  for (const v of ['.5:', ':2', '.5::2', '.5:<1 2>']) assert.ok(!isValueAtom(v, true), v);
});

test('effects: einzelne Zahl direkt, sonst Mini-Notation, ohne Steine gar nicht', () => {
  assert.equal(effectToCode(effect('lpf', [soundToken('800')]))?.text, '.lpf(800)');
  assert.equal(effectToCode(effect('room', [soundToken('.5')]))?.text, '.room(0.5)');
  assert.equal(effectToCode(effect('vowel', [soundToken('a')]))?.text, '.vowel("a")');
  assert.equal(effectToCode(effect('lpf', [soundToken('800', { random: 0.5 })]))?.text, '.lpf("800?")');
  assert.equal(
    effectToCode(effect('lpf', [openToken('<'), soundToken('200'), soundToken('800'), closeToken('<')]))?.text,
    '.lpf("<200 800>")',
  );
  assert.equal(effectToCode(effect('room')), null);
});

test('effects: Tippen schaltet durch die Werte, Fremdes springt auf den ersten', () => {
  const tokens = [soundToken('200'), soundToken('77')];
  quickSwitch(tokens, 0, ['100', '200', '500']);
  quickSwitch(tokens, 1, ['100', '200', '500']);
  assert.deepEqual(tokens.map((t) => t.kind === 'sound' && t.sound), ['500', '100']);
});

test('codegen: Name als Kommentar, stumm mit .hush(), Effekte in Reihenfolge, leere fehlen', () => {
  const code = toStrudelCode(
    [
      {
        name: 'drums',
        tokens: [soundToken('bd'), soundToken('sd')],
        effects: [effect('lpf', [soundToken('800')]), effect('delay'), effect('room', [soundToken('0.3')])],
      },
      { tokens: [soundToken('hh')], muted: true, volume: 0.6 },
    ],
    { cps: 0.5 },
  );
  assert.equal(code, 'setcps(0.5)\n\nstack(\n  /* drums */ s("bd sd").lpf(800).room(0.3),\n  s("hh").postgain(0.6).hush()\n)');
});

test('codegen: Positionen der Wertsteine zeigen im Code auf den Wert', () => {
  const v1 = soundToken('200');
  const v2 = soundToken('800');
  const { code, ranges } = toStrudelProgram(
    [{ name: 'a', tokens: [soundToken('bd')], effects: [effect('lpf', [openToken('<'), v1, v2, closeToken('<')])] }],
    { cps: 1 },
  );
  for (const [t, text] of [[v1, '200'], [v2, '800']] as const) {
    const r = ranges.find((x) => x.tokenId === t.id);
    assert.ok(r);
    assert.equal(code.slice(r.start, r.end), text);
  }
  assert.equal(trackToCode({ name: 'a', tokens: [soundToken('bd')] }).text, '/* a */ s("bd")');
});

test('codegen: Orbit bei Klangspuren nur, wenn nicht 1, vor der Lautstärke', () => {
  const bd = [soundToken('bd')];
  assert.equal(trackToCode({ tokens: bd, orbit: 1 }).text, 's("bd")');
  assert.equal(trackToCode({ tokens: bd, orbit: 3, volume: 0.5 }).text, 's("bd").orbit(3).postgain(0.5)');
});

test('codegen: MIDI-Spur endet mit Kanal und .midi(), ohne Orbit und Lautstärke', () => {
  const t = { tokens: [soundToken('bd')], type: 'midi' as const, orbit: 3, volume: 0.5, effects: [effect('note', [soundToken('c4')])] };
  assert.equal(trackToCode(t).text, 's("bd").note("c4").midichan(1).midi()');
  assert.equal(trackToCode({ ...t, channel: 10, port: "Bob's \\Port" }).text, `s("bd").note("c4").midichan(10).midi('Bob\\'s \\\\Port')`);
});

test('codegen: Notenspur mit note(), Klang in .s(), Orbit und Lautstärke', () => {
  const f = soundToken('f');
  const sine = soundToken('sine');
  const t = {
    name: 'mel',
    type: 'note' as const,
    tokens: [f, soundToken('d')],
    voice: { tokens: [sine] },
    effects: [effect('room', [soundToken('.5')])],
    orbit: 2,
    volume: 0.8,
  };
  assert.equal(trackToCode(t).text, '/* mel */ note("f d").s("sine").room(0.5).orbit(2).postgain(0.8)');
  assert.equal(trackToCode({ ...t, voice: { tokens: [] } }).text, '/* mel */ note("f d").room(0.5).orbit(2).postgain(0.8)');
  const { text, ranges } = trackToCode(t);
  for (const [tok, name] of [[f, 'f'], [sine, 'sine']] as const) {
    const r = ranges.find((x) => x.tokenId === tok.id);
    assert.ok(r, name);
    assert.equal(text.slice(r.start, r.end), name);
  }
  // Ein Klang in .s() bei einer anderen Spurart steht nicht im Code
  assert.equal(trackToCode({ ...t, type: 'sound' }).text, '/* mel */ s("f d").room(0.5).orbit(2).postgain(0.8)');
});

test('effects: Rechenarten für Noten aus Strudels Quelltext, getrennt von den Effekten', () => {
  assert.deepEqual(
    NOTE_OPS.map((o) => o.name),
    ['add', 'sub', 'mul', 'div'],
  );
  assert.equal(noteOpInfo('add')?.group, 'arith');
  assert.equal(effectInfo('add'), undefined, 'add ist kein Effekt');
  assert.equal(noteOpInfo('lpf'), undefined);
  assert.equal(valueInfo('div')?.name, 'div');
  assert.equal(valueInfo('lpf')?.name, 'lpf');
  assert.equal(searchNoteOps('di')[0].name, 'div');
});

test('effects: Sample-Funktionen aus Strudels Quelltext, nur in Klangspuren', () => {
  for (const n of ['chop', 'striate', 'scrub', 'loopAt', 'fit']) assert.equal(effectInfo(n)?.group, 'sample', n);
  assert.equal(effectInfo('slice'), undefined, 'slice braucht zwei Werte');
  assert.equal(effectInfo('fit')?.noValue, true);
  assert.equal(effectInfo('chop')?.noValue, undefined);
  assert.deepEqual(effectInfo('scrub')?.values, ['0.1', '.25', '0.7', '0.8'], 'ohne Zahlen hinter !, @, %');
  const offered = (type: TrackType) => searchEffects('', type, 1000).some((e) => e.name === 'scrub');
  assert.ok(offered('sound'));
  assert.ok(!offered('note') && !offered('midi'));
});

test('codegen: Sample-Funktionen wie Effekte, fit() ohne Wert', () => {
  const t = {
    tokens: [soundToken('brk')],
    effects: [effect('fit'), effect('chop', [soundToken('4')]), effect('scrub', [openToken('<'), soundToken('0'), soundToken('.5'), closeToken('<')]), effect('striate')],
  };
  assert.equal(trackToCode(t).text, 's("brk").fit().chop(4).scrub("<0 .5>")');
});

test('effects: Musterbefehle mit höchstens einem Wert aus Strudels Quelltext, mit Gruppe', () => {
  for (const n of ['fast', 'slow', 'ply', 'early', 'iter', 'struct', 'mask', 'rev', 'palindrome']) assert.equal(effectInfo(n)?.group, 'pattern', n);
  for (const n of ['degradeBy', 'degrade', 'shuffle', 'scramble']) assert.equal(effectInfo(n)?.group, 'random', n);
  for (const n of ['transpose', 'scale', 'scaleTranspose']) assert.equal(effectInfo(n)?.group, 'tonal', n);
  assert.equal(effectInfo('rev')?.noValue, true);
  assert.equal(effectInfo('fast')?.noValue, undefined);
  assert.equal(effectInfo('trans')?.name, 'transpose', 'Synonym');
  assert.ok(!effectInfo('fast')?.synonyms.includes('density'), 'density ist ein eigener Steuerparameter');
  assert.equal(effectInfo('density')?.group, 'audio');
  // Funktionen als Wert und mehrere Werte passen nicht in eine Wertreihe; Rechnen mit Zahlen ist keine Spurfunktion
  for (const n of ['jux', 'every', 'firstOf', 'sometimes', 'off', 'when', 'euclid', 'range', 'echo', 'pick', 'round']) {
    assert.equal(effectInfo(n), undefined, n);
  }
});

test('effects: Strukturen immer als Mini-Notation, beginnend mit x', () => {
  for (const n of ['struct', 'mask', 'reset', 'restart']) {
    const info = effectInfo(n);
    assert.equal(info?.miniOnly, true, n);
    assert.equal(info && defaultValue(info), 'x', n);
  }
  assert.equal(effectInfo('fast')?.miniOnly, undefined);
});

test('effects: Musterbefehle in jeder Spur, Tonhöhe nur bei Noten und MIDI', () => {
  const offered = (type: TrackType, name: string) => searchEffects('', type, 1000).some((e) => e.name === name);
  for (const type of ['sound', 'sampler', 'note', 'midi'] as const) {
    assert.ok(offered(type, 'fast') && offered(type, 'degradeBy') && offered(type, 'struct'), type);
  }
  for (const n of ['transpose', 'scale']) {
    assert.ok(offered('note', n) && offered('midi', n), n);
    assert.ok(!offered('sound', n) && !offered('sampler', n), n);
  }
});

test('effects: scale aus Grundton und Tonleiter von Tonal.js', () => {
  const info = effectInfo('scale');
  const [roots, types] = info?.parts ?? [];
  assert.equal(info && defaultValue(info), 'C:major');
  assert.ok(roots.includes('C') && roots.includes('F#') && roots.includes('Bb'));
  for (const t of ['major', 'minor', 'dorian', 'major:pentatonic', 'in-sen', 'lydian:#5p:pentatonic']) assert.ok(types.includes(t), t);
  assert.ok(!types.some((t) => t.includes("'")), 'Apostroph liest die Mini-Notation nicht');
  for (const t of types) assert.ok(isValueAtom(`C:${t}`, true), t);
  // Pfeiltasten wechseln den Grundton, die Tonleiter bleibt
  assert.equal(stepValue('C:minor', info?.values ?? [], 1), 'C#:minor');
});

test('effects: Werte aus Teilen trennen', () => {
  assert.deepEqual(splitParts('C:minor', 2), ['C', 'minor']);
  assert.deepEqual(splitParts('F#:major:pentatonic', 2), ['F#', 'major:pentatonic']);
  assert.deepEqual(splitParts('C', 2), ['C', '']);
  assert.deepEqual(splitParts('', 2), ['', '']);
});

test('effects: Intervalle als Wert (transpose)', () => {
  for (const v of ['3M', '-2M', '5P', '-12']) assert.ok(isValueAtom(v), v);
  assert.ok(!isValueAtom('3M:2'));
  assert.ok(!isValueAtom('C:minor'), 'nur in Listen');
});

test('codegen: Musterbefehle wie Effekte, ohne Wert mit ()', () => {
  const t = {
    tokens: [soundToken('bd')],
    effects: [
      effect('fast', [soundToken('2')]),
      effect('struct', [soundToken('x'), soundToken('~'), soundToken('x')]),
      effect('rev'),
      effect('degradeBy', [soundToken('.5')]),
    ],
  };
  assert.equal(trackToCode(t).text, 's("bd").fast(2).struct("x ~ x").rev().degradeBy(0.5)');
  const n = {
    type: 'note' as const,
    tokens: [soundToken('c'), soundToken('e')],
    voice: { tokens: [soundToken('piano')] },
    effects: [effect('scale', [soundToken('C:minor')]), effect('transpose', [soundToken('3M')])],
  };
  assert.equal(trackToCode(n).text, 'note("c e").s("piano").scale("C:minor").transpose("3M")');
});

test('codegen: Rechenarten stehen an der Mini-Notation der Noten, nur bei Notenspuren', () => {
  const zero = soundToken('0');
  const t = {
    type: 'note' as const,
    tokens: [soundToken('f'), soundToken('d')],
    noteOps: [effect('add', [openToken('<'), zero, soundToken('3'), closeToken('<')]), effect('div', [soundToken('2')]), effect('mul', [])],
    voice: { tokens: [soundToken('sine')] },
  };
  const { text, ranges } = trackToCode(t);
  assert.equal(text, 'note("f d".add("<0 3>").div(2)).s("sine")');
  const r = ranges.find((x) => x.tokenId === zero.id);
  assert.ok(r);
  assert.equal(text.slice(r.start, r.end), '0');
  assert.equal(trackToCode({ ...t, type: 'sound' }).text, 's("f d")');
});

test('codegen: eigene Aufnahme als Klang einer Notenspur wird eingebettet', () => {
  const samples = new Map([['rec1', 'data:audio/wav;base64,AAAA']]);
  const code = toStrudelCode([{ type: 'note', tokens: [soundToken('c')], voice: { tokens: [soundToken('rec1')] } }], { cps: 1, samples });
  assert.match(code, /rec1: 'data:audio/);
  assert.doesNotMatch(
    toStrudelCode([{ type: 'note', tokens: [soundToken('rec1')], voice: { tokens: [soundToken('sine')] } }], { cps: 1, samples }),
    /samples\(/,
    'Notensteine sind keine Klänge',
  );
});

test('types: Orbit und Kanal zählen im Kreis', () => {
  assert.equal(nextInCycle(1, 8), 2);
  assert.equal(nextInCycle(8, 8), 1);
  assert.equal(nextInCycle(16, 16), 1);
  assert.equal(nextInCycle(0, 8), 1);
});

test('types: Spurnamen nur mit erlaubten Zeichen, kein _ am Ende', () => {
  assert.equal(trackName('drums'), 'drums');
  assert.equal(trackName('Bass Linie!'), 'BassLinie');
  assert.equal(trackName('hä_2'), 'hä_2');
  assert.equal(trackName('x__'), 'x');
  assert.equal(trackName('$:'), '');
});

test('effects: Pfeiltasten springen zum nächsten Beispielwert', () => {
  const lpf = ['100', '200', '500', '1000'];
  assert.equal(stepValue('200', lpf, 1), '500');
  assert.equal(stepValue('300', lpf, 1), '500', 'zwischen zwei Werten');
  assert.equal(stepValue('300', lpf, -1), '200');
  assert.equal(stepValue('1000', lpf, 1), '1000', 'am Rand bleibt es');
  assert.equal(stepValue('a', ['a', 'e', 'i'], 1), 'e');
  assert.equal(stepValue('a', ['a', 'e', 'i'], -1), 'i', 'Namen im Kreis');
  assert.equal(stepValue('3', [], 1), '4');
  assert.equal(stepValue('0.5', [], -1), '0.4');
  assert.equal(stepValue('', lpf, 1), '100');
  assert.equal(stepValue('200:2', lpf, 1), '500:2', 'nach dem Doppelpunkt bleibt es');
  assert.equal(stepValue('0.5:1.5', [], -1), '0.4:1.5');
});

test('effects: Regler nur für einen einzelnen Stein ohne Zufall und Wiederholung', () => {
  assert.equal(singleValue([soundToken('800')]), '800');
  assert.equal(singleValue([soundToken('sine')]), 'sine');
  assert.equal(singleValue([]), null);
  assert.equal(singleValue([soundToken('200'), soundToken('800')]), null);
  assert.equal(singleValue([soundToken('800', { random: 0.5 })]), null);
  assert.equal(singleValue([soundToken('800', { repeat: { op: '*', value: 2 } })]), null);
  assert.equal(singleValue([openToken('<'), soundToken('800'), closeToken('<')]), null);
});

test('effects: Reglerbereich aus Strudels Beispielwerten', () => {
  const info = (values: string[]) => ({ name: 'x', group: 'audio' as const, synonyms: [], description: '', hint: '', values });
  assert.deepEqual(valueScale(info(['100', '200', '500'])), { kind: 'number', stops: [100, 200, 500] });
  assert.deepEqual(valueScale(info(['.5'])), { kind: 'number', stops: [0, 1] });
  assert.deepEqual(valueScale(info(['4'])), { kind: 'number', stops: [0, 8] });
  assert.deepEqual(valueScale(info(['-2'])), { kind: 'number', stops: [-4, 0] });
  assert.deepEqual(valueScale(info([])), { kind: 'number', stops: [0, 1] });
  assert.deepEqual(valueScale(undefined), { kind: 'number', stops: [0, 1] });
  assert.deepEqual(valueScale(info(['a', 'e', 'i'])), { kind: 'words', words: ['a', 'e', 'i'] });
  // Jeder Effekt aus Strudel bekommt einen brauchbaren Regler
  for (const e of [...EFFECTS, ...NOTE_OPS]) {
    const s = valueScale(e);
    if (s.kind === 'number') assert.ok(s.stops.length >= 2 && s.stops[0] < s.stops[s.stops.length - 1], e.name);
    else assert.ok(s.words.length > 0, e.name);
  }
});

test('effects: Regler verteilt Beispielwerte gleichmässig, rastet ein und rundet passend', () => {
  const stops = [100, 200, 500, 1000, 2000];
  assert.equal(toSlider(100, stops), 0);
  assert.equal(toSlider(500, stops), 0.5);
  assert.equal(toSlider(2000, stops), 1);
  assert.equal(toSlider(5, stops), 0);
  assert.equal(toSlider(9000, stops), 1);
  assert.equal(toSlider(350, stops), 0.375);
  for (const v of stops) assert.equal(fromSlider(toSlider(v, stops), stops), v);
  assert.equal(fromSlider(0.505, stops), 500, 'rastet nahe einem Beispielwert ein');
  assert.equal(fromSlider(0.375, stops), 350);
  assert.equal(fromSlider(0.1, [0, 1]), 0.1);
  assert.equal(fromSlider(0.333333, [0, 1]), 0.33);
  assert.equal(fromSlider(-1, stops), 100);
  assert.equal(fromSlider(2, stops), 2000);
});

test('effects: mit eingestelltem Regler steht slider() im Code, nur bei einer einzelnen Zahl', () => {
  const slider = { min: 100, max: 8000, step: 10 };
  assert.equal(effectToCode({ ...effect('lpf', [soundToken('800')]), slider })?.text, '.lpf(slider(800, 100, 8000, 10))');
  assert.equal(effectToCode({ ...effect('lpf', [soundToken('800')]), slider: null })?.text, '.lpf(800)');
  assert.equal(
    effectToCode({ ...effect('lpf', [openToken('<'), soundToken('200'), soundToken('800'), closeToken('<')]), slider })?.text,
    '.lpf("<200 800>")',
    'Mini-Notation behält den Bereich, schreibt ihn aber nicht',
  );
  assert.equal(effectToCode({ ...effect('vowel', [soundToken('a')]), slider })?.text, '.vowel("a")', 'Namen nie als slider()');
});

test('effects: Vorschlag für den Regler aus den Beispielwerten, mit rundem Schritt', () => {
  assert.deepEqual(suggestSliderRange(effectInfo('lpf'), 800), { min: 100, max: 4000, step: 10 });
  assert.deepEqual(suggestSliderRange(effectInfo('lpf'), 20000), { min: 100, max: 20000, step: 100 });
  assert.deepEqual(suggestSliderRange(undefined, null), { min: 0, max: 1, step: 0.01 });
  for (const e of EFFECTS) assert.ok(isSliderRange(suggestSliderRange(e, null)), e.name);
  assert.ok(!isSliderRange({ min: 1, max: 1, step: 1 }));
  assert.ok(!isSliderRange({ min: 0, max: 1, step: 0 }));
  assert.ok(!isSliderRange({ min: 0, max: NaN, step: 1 }));
});

test('toRange/fromRange: linear im eingestellten Bereich, auf step gerundet', () => {
  const r = { min: 100, max: 8000, step: 10 };
  assert.equal(toRange(100, r), 0);
  assert.equal(toRange(8000, r), 1);
  assert.equal(toRange(9000, r), 1);
  assert.equal(fromRange(0.5, r), 4050);
  assert.equal(fromRange(1.2, r), 8000);
  assert.equal(fromRange(0.333, { min: 0, max: 1, step: 0.01 }), 0.33);
  assert.equal(fromRange(0.5, { min: 0, max: 1, step: 0.25 }), 0.5);
  assert.equal(fromRange(1, { min: 0, max: 1, step: 0.3 }), 0.9);
});

test('sliderStep: runde Zahl um ein Hundertstel des Bereichs', () => {
  assert.equal(sliderStep(100, 8000), 10);
  assert.equal(sliderStep(0, 1), 0.01);
  assert.equal(sliderStep(-12, 12), 0.1);
  assert.equal(sliderStep(5, 5), 1);
  assert.equal(sliderStep(5, 1), 1);
});

test('Zufallsreihe: Code statt der Wertsteine, ganze Zahlen mit round()', () => {
  const rand = { min: 200, max: 2000, segments: 4, offset: 12, cycles: 2, ribbon: true, whole: false };
  assert.equal(randToCode(rand), 'rand.range(200, 2000).segment(4).ribbon(12, 2)');
  assert.equal(randToCode({ ...rand, whole: true }), 'rand.range(200, 2000).round().segment(4).ribbon(12, 2)');
  assert.equal(randToCode({ ...rand, ribbon: false }), 'rand.range(200, 2000).segment(4)', 'ohne ribbon');
  const fx = { ...effect('lpf', [soundToken('800')]), rand };
  assert.equal(effectToCode(fx)?.text, '.lpf(rand.range(200, 2000).segment(4).ribbon(12, 2))');
  assert.equal(effectToCode({ ...effect('lpf'), rand })?.text, '.lpf(rand.range(200, 2000).segment(4).ribbon(12, 2))', 'auch ohne Steine');
  assert.equal(effectToCode({ ...fx, rand: null })?.text, '.lpf(800)');
});

test('Zufallsreihe: gültig, ganze Zahlen aus den Beispielwerten, Vorschlag', () => {
  const ok = { min: 0, max: 1, segments: 4, offset: 0, cycles: 1, ribbon: true, whole: false };
  assert.ok(isRandSeries(ok));
  assert.ok(isRandSeries({ ...ok, offset: -3.5, cycles: 0.5 }));
  assert.ok(!isRandSeries({ ...ok, min: 1 }), 'min unter max');
  assert.ok(!isRandSeries({ ...ok, segments: 0 }), 'Segmente ab 1');
  assert.ok(!isRandSeries({ ...ok, segments: 2.5 }), 'Segmente ganz');
  assert.ok(!isRandSeries({ ...ok, cycles: 0 }), 'Zyklen über 0');
  assert.ok(!isRandSeries({ ...ok, offset: NaN }));

  assert.equal(wholeValues(effectInfo('coarse'), 1, 32), true);
  assert.equal(wholeValues(effectInfo('coarse'), 0.5, 32), false, 'min nicht ganz');
  assert.equal(wholeValues(effectInfo('room'), 0, 1), false, 'Beispielwerte mit Komma');
  assert.equal(wholeValues(undefined, 0, 1), false, 'ohne Beispielwerte');

  assert.deepEqual(suggestRandSeries(effectInfo('lpf'), 800), { min: 100, max: 4000, segments: 4, offset: 0, cycles: 1, ribbon: true, whole: true });
  assert.deepEqual(
    suggestRandSeries(effectInfo('room'), null, { min: 0, max: 2, step: 0.01 }),
    { min: 0, max: 2, segments: 4, offset: 0, cycles: 1, ribbon: true, whole: false },
    'eingestellter Bereich zuerst',
  );
  for (const e of EFFECTS) assert.ok(isRandSeries(suggestRandSeries(e, null)), e.name);
});

test('Modulation: Welle statt der Wertsteine, slow(1) entfällt, ganze Zahlen mit round()', () => {
  const mod = { wave: 'sine' as const, min: 200, max: 2000, segments: 16, slow: 4, whole: false };
  assert.equal(modToCode(mod), 'sine.range(200, 2000).segment(16).slow(4)');
  assert.equal(modToCode({ ...mod, wave: 'square', slow: 1, whole: true }), 'square.range(200, 2000).round().segment(16)');
  assert.equal(effectToCode({ ...effect('lpf', [soundToken('800')]), mod })?.text, '.lpf(sine.range(200, 2000).segment(16).slow(4))');
  assert.equal(effectToCode({ ...effect('lpf'), mod })?.text, '.lpf(sine.range(200, 2000).segment(16).slow(4))', 'auch ohne Steine');

  assert.ok(isModSeries(mod));
  assert.ok(!isModSeries({ ...mod, wave: 'noise' as never }), 'unbekannte Welle');
  assert.ok(!isModSeries({ ...mod, min: 3000 }), 'min unter max');
  assert.ok(!isModSeries({ ...mod, segments: 0 }), 'Segmente ab 1');
  assert.ok(!isModSeries({ ...mod, slow: 0 }), 'Dauer über 0');
  assert.deepEqual(suggestModSeries(effectInfo('room'), null), { wave: 'sine', min: 0, max: 1, segments: 16, slow: 4, whole: false });
  for (const e of EFFECTS) assert.ok(isModSeries(suggestModSeries(e, null)), e.name);
});

test('LFO: Strudels lfo nach dem Wert, control immer, dcoffset und skew nur abweichend', () => {
  const lfo = { shape: 'sine' as const, speed: 0.25, unit: 'sync' as const, depth: 0.5, absolute: false, dcoffset: -0.5, skew: 0.5 };
  assert.equal(lfoToCode('lpf', lfo), ".lfo({ control: 'lpf', shape: 'sine', sync: 0.25, depth: 0.5 })");
  assert.equal(
    lfoToCode('room', { ...lfo, shape: 'square', unit: 'rate', speed: 2, absolute: true, depth: 0.4, dcoffset: 0, skew: 0.2 }),
    ".lfo({ control: 'room', shape: 'square', rate: 2, depthabs: 0.4, dcoffset: 0, skew: 0.2 })",
  );
  assert.equal(
    effectToCode({ ...effect('lpf', [soundToken('800')]), lfo })?.text,
    ".lpf(800).lfo({ control: 'lpf', shape: 'sine', sync: 0.25, depth: 0.5 })",
  );
  assert.equal(
    effectToCode({ ...effect('lpf', [soundToken('800')]), slider: { min: 100, max: 8000, step: 10 }, lfo })?.text,
    ".lpf(slider(800, 100, 8000, 10)).lfo({ control: 'lpf', shape: 'sine', sync: 0.25, depth: 0.5 })",
    'mit Regler',
  );
  assert.equal(effectToCode({ ...effect('lpf'), lfo }), null, 'ohne Wert aus, samt LFO');

  assert.ok(isLfoSeries(lfo));
  assert.ok(isLfoSeries(LFO_DEFAULTS));
  assert.ok(isLfoSeries(suggestLfoSeries()));
  assert.ok(!isLfoSeries({ ...lfo, shape: 'cosine' as never }), 'nur Strudels Formen');
  assert.ok(!isLfoSeries({ ...lfo, depth: 0 }), 'Tiefe über 0');
  assert.ok(!isLfoSeries({ ...lfo, speed: 0 }), 'Tempo über 0');
  assert.ok(!isLfoSeries({ ...lfo, skew: 1.5 }), 'skew bis 1');
  assert.ok(isLfoSeries({ ...lfo, dcoffset: -1 }), 'dcoffset frei');

  assert.equal(convertLfoDepth(lfo, true, 800), 400, 'relativ 0.5 bei 800 = absolut 400');
  assert.equal(convertLfoDepth({ ...lfo, absolute: true, depth: 400 }, false, 800), 0.5);
  assert.equal(convertLfoDepth(lfo, true, 0), 0.5, 'Wert 0 rechnet superdough als 1');
  assert.equal(convertLfoDepth(lfo, false, 800), 0.5, 'gleiche Art bleibt');
});

test('LFO: nur Effekte, die superdough modulieren kann', () => {
  for (const n of ['lpf', 'hpf', 'room', 'delay', 'gain', 'pan', 'crush', 'phaser']) assert.ok(effectInfo(n)?.modulatable, n);
  for (const n of ['speed', 'begin', 'attack', 'fast', 'chop']) assert.ok(!effectInfo(n)?.modulatable, n);
});

test('Kategorien: Familien nach Präfix, Musterbefehle nach Gruppe, kaum Unbekanntes', () => {
  const cat = (name: string) => categoryOf(effectInfo(name)!);
  assert.equal(cat('lpf'), 'filter');
  assert.equal(cat('hpq'), 'filter');
  assert.equal(cat('attack'), 'envelope');
  assert.equal(cat('room'), 'space');
  assert.equal(cat('delayfeedback'), 'space');
  assert.equal(cat('distort'), 'distortion');
  assert.equal(cat('phaser'), 'motion');
  assert.equal(cat('fmi'), 'synth');
  assert.equal(cat('penv'), 'pitch');
  assert.equal(cat('pan'), 'level');
  assert.equal(cat('speed'), 'sample');
  assert.equal(cat('chop'), 'sample');
  assert.equal(cat('fast'), 'pattern');
  assert.equal(cat('degradeBy'), 'random');
  assert.equal(cat('transpose'), 'tonal');
  const other = EFFECTS.filter((e) => categoryOf(e) === 'other');
  assert.ok(other.length <= 5, `ohne Kategorie: ${other.map((e) => e.name).join(' ')}`);
});

test('browseEffects: ganze Liste einer Kategorie, nur was zur Spur passt', () => {
  const filters = browseEffects('', 'sound', 'filter');
  assert.ok(filters.length > 12);
  assert.ok(filters.every((e) => categoryOf(e) === 'filter'));
  assert.deepEqual(browseEffects('', 'midi', 'filter'), []);
  assert.equal(browseEffects('lpf', 'sound', null)[0].name, 'lpf');
  assert.ok(browseEffects('scale', 'note', null).some((e) => e.name === 'scale'));
  assert.ok(!browseEffects('scale', 'note', null, true).some((e) => e.name === 'scale'), 'relative Spur hat ihre Tonleiter schon');
});
