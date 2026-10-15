import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EFFECTS,
  NOTE_OPS,
  defaultValue,
  effectInfo,
  fromSlider,
  isSliderRange,
  suggestSliderRange,
  isValueAtom,
  noteOpInfo,
  searchEffects,
  searchNoteOps,
  singleValue,
  stepValue,
  toSlider,
  valueInfo,
  valueScale,
} from './effects.ts';
import { effectToCode, toStrudelCode, toStrudelProgram, trackToCode } from './codegen.ts';
import { quickSwitch } from './edit.ts';
import { closeToken, effect, nextInCycle, openToken, soundToken, trackName } from './types.ts';
import type { TrackType } from './types.ts';
// @ts-expect-error reines JavaScript ohne Typen
import { OUTPUT, extractEffects, extractNoteOps, extractSamplerModes, renderModule } from '../../../scripts/strudel-effects.mjs';

test('effects: die erzeugte Liste passt zum installierten Strudel (sonst npm run gen:effects)', () => {
  assert.equal(readFileSync(OUTPUT, 'utf8'), renderModule(extractEffects(), extractNoteOps(), extractSamplerModes()));
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
  for (const v of ['', '1 2', '<1 2>', '"a"', '1.2.3x']) assert.ok(!isValueAtom(v), v);
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

test('codegen: Name nach dem $, stumm mit _, Effekte in Reihenfolge, leere fehlen', () => {
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
  assert.equal(code, 'setcps(0.5)\n\n$drums: s("bd sd").lpf(800).room(0.3)\n_$: s("hh").postgain(0.6)');
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
  assert.equal(trackToCode({ name: 'a', tokens: [soundToken('bd')] }).text, '$a: s("bd")');
});

test('codegen: Orbit bei Klangspuren nur, wenn nicht 1, vor der Lautstärke', () => {
  const bd = [soundToken('bd')];
  assert.equal(trackToCode({ tokens: bd, orbit: 1 }).text, '$: s("bd")');
  assert.equal(trackToCode({ tokens: bd, orbit: 3, volume: 0.5 }).text, '$: s("bd").orbit(3).postgain(0.5)');
});

test('codegen: MIDI-Spur endet mit Kanal und .midi(), ohne Orbit und Lautstärke', () => {
  const t = { tokens: [soundToken('bd')], type: 'midi' as const, orbit: 3, volume: 0.5, effects: [effect('note', [soundToken('c4')])] };
  assert.equal(trackToCode(t).text, '$: s("bd").note("c4").midichan(1).midi()');
  assert.equal(trackToCode({ ...t, channel: 10, port: "Bob's \\Port" }).text, `$: s("bd").note("c4").midichan(10).midi('Bob\\'s \\\\Port')`);
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
  assert.equal(trackToCode(t).text, '$mel: note("f d").s("sine").room(0.5).orbit(2).postgain(0.8)');
  assert.equal(trackToCode({ ...t, voice: { tokens: [] } }).text, '$mel: note("f d").room(0.5).orbit(2).postgain(0.8)');
  const { text, ranges } = trackToCode(t);
  for (const [tok, name] of [[f, 'f'], [sine, 'sine']] as const) {
    const r = ranges.find((x) => x.tokenId === tok.id);
    assert.ok(r, name);
    assert.equal(text.slice(r.start, r.end), name);
  }
  // Ein Klang in .s() bei einer anderen Spurart steht nicht im Code
  assert.equal(trackToCode({ ...t, type: 'sound' }).text, '$mel: s("f d").room(0.5).orbit(2).postgain(0.8)');
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
  assert.equal(trackToCode(t).text, '$: s("brk").fit().chop(4).scrub("<0 .5>")');
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
  assert.equal(text, '$: note("f d".add("<0 3>").div(2)).s("sine")');
  const r = ranges.find((x) => x.tokenId === zero.id);
  assert.ok(r);
  assert.equal(text.slice(r.start, r.end), '0');
  assert.equal(trackToCode({ ...t, type: 'sound' }).text, '$: s("f d")');
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
