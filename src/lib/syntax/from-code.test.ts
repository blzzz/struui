import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackToCode } from '../domain/codegen.ts';
import { codeToTrack } from './from-code.ts';

function roundTrip(code: string): string {
  const r = codeToTrack(code);
  assert.ok(r.ok, `${code} ist gültig${r.ok ? '' : `: ${r.message}`}`);
  return trackToCode(r).text;
}

test('code: ganze Zeile mit Name (Kommentar), Stummschaltung (.hush()) und Effekten wird zur Spur und zurück', () => {
  const cases: [string, string][] = [
    ['s("bd sd")', 's("bd sd")'],
    ['/* drums */ s("bd  hh*2").lpf(800)', '/* drums */ s("bd hh*2").lpf(800)'],
    ['/* bass */ sound(\'bd\') .room( .5 ) .vowel("<a e>") .hush( )', '/* bass */ s("bd").room(0.5).vowel("<a e>").hush()'],
    ['  /*   bass */s("bd").hush()', '/* bass */ s("bd").hush()'],
    ['/* m */ s("bd").midi().hush()', '/* m */ s("bd").midichan(1).midi().hush()'],
    ['/* Klangspur_1 */ s("bd")', '/* Klangspur_1 */ s("bd")'],
    ['/* x */ s("bd").lpf("<200 [400 800]>?").cutoff(-1)', '/* x */ s("bd").lpf("<200 [400 800]>?").cutoff(-1)'],
    ['s("")', 's("")'],
    ['/* a */ s("bd").postgain(.5).lpf(800)', '/* a */ s("bd").lpf(800).postgain(0.5)'],
    ['/* a */ s("bd").postgain(1)', '/* a */ s("bd")'],
    ['/* a */ s("bd").orbit(2).postgain(.5)', '/* a */ s("bd").orbit(2).postgain(0.5)'],
    ['/* a */ s("bd").orbit(1)', '/* a */ s("bd")'],
    ['/* m */ s("bd").note("c4 e4").midi()', '/* m */ s("bd").note("c4 e4").midichan(1).midi()'],
    ['/* m */ s("bd").midichan(10).ccv(.5).midi("IAC Driver Bus 1")', `/* m */ s("bd").ccv(0.5).midichan(10).midi('IAC Driver Bus 1')`],
    [`/* m */ s("bd").midi('Bob\\'s')`, `/* m */ s("bd").midichan(1).midi('Bob\\'s')`],
    ['/* n */ note("f d").s("sine")', '/* n */ note("f d").s("sine")'],
    ['/* n */ note("<c e> g").lpf(800).sound("<sine sawtooth>").orbit(2)', '/* n */ note("<c e> g").s("<sine sawtooth>").lpf(800).orbit(2)'],
    ['/* n */ note("c")', '/* n */ note("c")'],
    ['/* n */ note("f d" .add("<0 3>").div( 2 )).s("sine")', '/* n */ note("f d".add("<0 3>").div(2)).s("sine")'],
    ['/* b */ s("brk/2").fit( ).scrub("<0 .25>").chop(4)', '/* b */ s("brk/2").fit().scrub("<0 .25>").chop(4)'],
    ['/* d */ s("bd sd").fast(2).struct("x ~ x x").rev().degradeBy(.3)', '/* d */ s("bd sd").fast(2).struct("x ~ x x").rev().degradeBy(0.3)'],
    ['/* n */ note("c e g").s("piano").scale("C:major:pentatonic").transpose("<0 3M>")', '/* n */ note("c e g").s("piano").scale("C:major:pentatonic").transpose("<0 3M>")'],
    ['/* n */ note("c e").trans(-2)', '/* n */ note("c e").trans(-2)'],
    ['/* r */ n("0 2 -1 4#").scale("C4:major").s("sine")', '/* r */ n("0 2 -1 4#").scale("C4:major").s("sine")'],
    ['/* r */ n("0 2" .add( 2 )) .scale( \'Bb:dorian\' ).lpf(800)', '/* r */ n("0 2".add(2)).scale("Bb3:dorian").lpf(800)'],
    ['/* r */ n("<0 [2 4]>").scale("f#2:major:pentatonic")', '/* r */ n("<0 [2 4]>").scale("F#2:major:pentatonic")'],
  ];
  for (const [input, expected] of cases) assert.equal(roundTrip(input), expected, input);
});

test('code: n(…).scale(…) ist eine relative Notenspur, note(…) eine absolute', () => {
  const r = codeToTrack('/* r */ n("0 2").scale("A3:minor")');
  assert.ok(r.ok);
  assert.equal(r.type, 'note');
  assert.equal(r.pitch, 'relative');
  assert.deepEqual(r.scale, { root: 'A', octave: 3, type: 'minor' });
  const a = codeToTrack('/* a */ note("c e")');
  assert.ok(a.ok);
  assert.equal(a.pitch, 'absolute');
  assert.equal(a.scale, null);
});

test('code: Effekte werden zu Wertsteinen', () => {
  const r = codeToTrack('/* a */ s("bd").lpf("<200 800>")');
  assert.ok(r.ok);
  assert.equal(r.name, 'a');
  assert.equal(r.muted, false);
  const plain = codeToTrack('s("bd").hush()');
  assert.ok(plain.ok);
  assert.equal(plain.name, '', 'ohne Kommentar kein Name (den Standardnamen setzt das Projekt)');
  assert.equal(plain.muted, true);
  assert.deepEqual(
    r.effects[0].tokens.map((t) => t.kind),
    ['open', 'sound', 'sound', 'close'],
  );
});

test('code: Fehler nennen die Stelle', () => {
  const at = (code: string) => {
    const r = codeToTrack(code);
    assert.ok(!r.ok, code);
    return r.offset;
  };
  assert.equal(at('/* a */ s("bd").foo(1)'), 16, 'unbekannter Effekt');
  assert.equal(at('/* a */ s("bd [sd")'), 17, 'Mini-Notation: fehlende ] am Ende, Stelle in der Zeile');
  assert.equal(at('/* a_ */ s("bd")'), 0, 'Name: kein _ am Ende');
  assert.equal(at('/* a b */ s("bd")'), 0, 'Name: ein Wort');
  assert.equal(at('/* a s("bd")'), 0, 'Kommentar nicht geschlossen');
  assert.equal(at('$a: s("bd")'), 0, 'altes Label: Hinweis auf den Kommentar');
  assert.equal(at('/* a */ s("bd").hush().lpf(800)'), 22, 'nach .hush() nichts mehr');
  assert.equal(at('/* a */ s("bd").hush(1)'), 21, 'hush() nimmt keinen Wert');
  assert.equal(at('/* a */ s("bd").lpf(800'), 23, 'Klammer fehlt');
  assert.equal(at('/* a */ s("bd").postgain("<1 .5>")'), 25, 'Lautstärke nur als Zahl');
  assert.equal(at('/* a */ s("bd").orbit(9)'), 22, 'Orbit 1–8');
  assert.equal(at('/* a */ s("bd").midichan(2)'), 16, 'Kanal nur mit .midi()');
  assert.equal(at('/* a */ s("bd").orbit(2).midi()'), 16, 'Orbit nicht bei MIDI');
  assert.equal(at('/* a */ s("bd").midi().lpf(800)'), 22, 'nach .midi() nichts mehr');
  assert.equal(at('/* a */ s("bd").midichan(17).midi()'), 25, 'Kanal 1–16');
  assert.equal(at('/* a */ s("bd").s("sine")'), 16, '.s() nur bei Notenspuren');
  assert.equal(at('/* a */ note("c").s("a").s("b")'), 25, '.s() nur einmal');
  assert.equal(at('/* a */ note("c").midi()'), 18, 'Notenspuren gehen nicht an MIDI');
  assert.equal(at('/* a */ n("0")'), 14, 'n() braucht die Tonleiter direkt danach');
  assert.equal(at('/* a */ n("0").scale("C4:gibtsnicht")'), 22, 'unbekannte Tonleiter');
  assert.equal(at('/* a */ s("bd".add(1))'), 14, 'Rechnen nur in note()');
  assert.equal(at('/* a */ note("c".foo(1))'), 17, 'unbekannte Rechenart');
  assert.equal(at('/* a */ note("c".lpf(1))'), 17, 'Effekte nicht an der Mini-Notation');
  assert.equal(at('/* a */ s("bd").fit(1)'), 20, 'fit() nimmt keinen Wert');
});

test('code: MIDI-Spur mit Kanal und Ausgang', () => {
  const r = codeToTrack(`/* m */ s("bd").midichan(3).midi('Bob\\'s Port')`);
  assert.ok(r.ok);
  assert.equal(r.type, 'midi');
  assert.equal(r.channel, 3);
  assert.equal(r.port, "Bob's Port");
  const s = codeToTrack('/* a */ s("bd").orbit(4)');
  assert.ok(s.ok);
  assert.equal(s.type, 'sound');
  assert.equal(s.orbit, 4);
});

test('code: Notenspur mit Klang in .s()', () => {
  const r = codeToTrack('/* n */ note("f d").s("sine")');
  assert.ok(r.ok);
  assert.equal(r.type, 'note');
  assert.deepEqual(r.tokens.map((t) => (t.kind === 'sound' ? t.sound : t.kind)), ['f', 'd']);
  assert.deepEqual(r.voice?.tokens.map((t) => (t.kind === 'sound' ? t.sound : t.kind)), ['sine']);
  const none = codeToTrack('/* n */ note("f")');
  assert.ok(none.ok);
  assert.equal(none.voice, null);
});

test('code: slider(wert, min, max, step) wird zum Regler und zurück', () => {
  const cases: [string, string][] = [
    ['/* a */ s("bd").lpf(slider(800, 100, 8000, 10))', '/* a */ s("bd").lpf(slider(800, 100, 8000, 10))'],
    ['/* a */ s("bd").room( slider( .5 , 0 , 1 , .01 ) )', '/* a */ s("bd").room(slider(0.5, 0, 1, 0.01))'],
    ['/* a */ s("bd").room(slider(.5))', '/* a */ s("bd").room(slider(0.5, 0, 1, 0.01))'],
    ['/* a */ s("bd").lpf(slider(800, 0, 2000))', '/* a */ s("bd").lpf(slider(800, 0, 2000, 20))'],
    ['/* n */ note("c e".add(slider(3, 0, 12, 1))).s("sine")', '/* n */ note("c e".add(slider(3, 0, 12, 1))).s("sine")'],
  ];
  for (const [input, expected] of cases) assert.equal(roundTrip(input), expected, input);
  const r = codeToTrack('/* a */ s("bd").lpf(slider(800, 100, 8000, 10)).room(.5)');
  assert.ok(r.ok);
  assert.deepEqual(r.effects[0].slider, { min: 100, max: 8000, step: 10 });
  assert.equal(r.effects[0].tokens.length, 1);
  assert.equal(r.effects[1].slider, null);

  const bad = codeToTrack('/* a */ s("bd").lpf(slider(800, 900, 100))');
  assert.ok(!bad.ok);
  assert.equal(bad.offset, '/* a */ s("bd").lpf('.length);
  assert.ok(!codeToTrack('/* a */ s("bd").lpf(slider("<1 2>"))').ok, 'slider nimmt nur Zahlen');
});

test('code: rand.range(…).segment(…).ribbon(…) wird zur Zufallsreihe und zurück', () => {
  const cases: [string, string][] = [
    ['/* a */ s("bd").lpf(rand.range(200, 2000).segment(4).ribbon(0, 1))', '/* a */ s("bd").lpf(rand.range(200, 2000).segment(4).ribbon(0, 1))'],
    ['/* a */ s("bd").coarse( rand .range( 1,16 ) .round( ) .seg(8) .rib(12, .5) )', '/* a */ s("bd").coarse(rand.range(1, 16).round().segment(8).ribbon(12, 0.5))'],
    ['/* n */ note("c e".add(rand.range(0, 7).round().segment(4).ribbon(3, 2))).s("sine")', '/* n */ note("c e".add(rand.range(0, 7).round().segment(4).ribbon(3, 2))).s("sine")'],
  ];
  for (const [input, expected] of cases) assert.equal(roundTrip(input), expected, input);
  const r = codeToTrack('/* a */ s("bd").lpf(rand.range(200, 2000).segment(4).ribbon(12, 2)).room(.5)');
  assert.ok(r.ok);
  assert.deepEqual(r.effects[0].rand, { min: 200, max: 2000, segments: 4, offset: 12, cycles: 2, ribbon: true, whole: false });
  assert.deepEqual(r.effects[0].tokens, []);
  assert.equal(r.effects[1].rand, null);
  assert.equal(roundTrip('/* a */ s("bd").lpf(rand.range(200, 2000).seg(4))'), '/* a */ s("bd").lpf(rand.range(200, 2000).segment(4))');
  const free = codeToTrack('/* a */ s("bd").lpf(rand.range(200, 2000).segment(4))');
  assert.ok(free.ok);
  assert.deepEqual(free.effects[0].rand, { min: 200, max: 2000, segments: 4, offset: 0, cycles: 1, ribbon: false, whole: false });

  for (const bad of [
    '/* a */ s("bd").lpf(rand)',
    '/* a */ s("bd").lpf(rand.range(200, 2000))',
    '/* a */ s("bd").lpf(rand.range(200, 2000).ribbon(0, 1))',
    '/* a */ s("bd").lpf(rand.range(2000, 200).segment(4).ribbon(0, 1))',
    '/* a */ s("bd").lpf(rand.range(200, 2000).segment(0).ribbon(0, 1))',
    '/* a */ s("bd").lpf(rand.range(200, 2000).segment(4).ribbon(0, 1).fast(2))',
  ]) assert.ok(!codeToTrack(bad).ok, bad);
});

test('code: sine.range(…).segment(…).slow(…) wird zur Modulation und zurück', () => {
  const cases: [string, string][] = [
    ['/* a */ s("bd").lpf(sine.range(200, 2000).segment(16).slow(4))', '/* a */ s("bd").lpf(sine.range(200, 2000).segment(16).slow(4))'],
    ['/* a */ s("bd").lpf(saw.range(200, 2000).seg(8))', '/* a */ s("bd").lpf(saw.range(200, 2000).segment(8))'],
    ['/* a */ s("bd").lpf(tri .range( 1, 16 ).round().segment(4).slow(1))', '/* a */ s("bd").lpf(tri.range(1, 16).round().segment(4))'],
    ['/* n */ note("c".add(perlin.range(0, 7).round().segment(4).slow(.5))).s("sine")', '/* n */ note("c".add(perlin.range(0, 7).round().segment(4).slow(0.5))).s("sine")'],
  ];
  for (const [input, expected] of cases) assert.equal(roundTrip(input), expected, input);
  const r = codeToTrack('/* a */ s("bd").lpf(isaw.range(200, 2000).segment(16).slow(2)).room(.5)');
  assert.ok(r.ok);
  assert.deepEqual(r.effects[0].mod, { wave: 'isaw', min: 200, max: 2000, segments: 16, slow: 2, whole: false });
  assert.deepEqual(r.effects[0].tokens, []);
  assert.equal(r.effects[1].mod, null);

  for (const bad of [
    '/* a */ s("bd").lpf(sine)',
    '/* a */ s("bd").lpf(sine.range(200, 2000))',
    '/* a */ s("bd").lpf(sine.range(2000, 200).segment(4))',
    '/* a */ s("bd").lpf(sine.range(200, 2000).segment(4).slow(0))',
    '/* a */ s("bd").lpf(sine.range(200, 2000).segment(4).fast(2))',
    '/* a */ s("bd").lpf(sine2.range(200, 2000).segment(4))',
  ]) assert.ok(!codeToTrack(bad).ok, bad);
});

test('code: sine2.mul(…).add(…).segment(…) wird zum LFO und zurück', () => {
  const cases: [string, string][] = [
    ['/* a */ s("bd").lpf(sine2.mul(400).add(800).segment(16).slow(4))', '/* a */ s("bd").lpf(sine2.mul(400).add(800).segment(16).slow(4))'],
    ['/* a */ s("bd").lpf(saw2 .early(.25).mul( 400 ).add(800).seg(8).slow(1))', '/* a */ s("bd").lpf(saw2.early(0.25).mul(400).add(800).segment(8))'],
    ['/* n */ note("c".add(square2.mul(3).add(-2).round().segment(4))).s("sine")', '/* n */ note("c".add(square2.mul(3).add(-2).round().segment(4))).s("sine")'],
  ];
  for (const [input, expected] of cases) assert.equal(roundTrip(input), expected, input);
  const r = codeToTrack('/* a */ s("bd").lpf(cosine2.early(0.5).mul(400).add(800).segment(16).slow(2)).room(.5)');
  assert.ok(r.ok);
  assert.deepEqual(r.effects[0].lfo, { wave: 'cosine', center: 800, depth: 400, segments: 16, slow: 2, phase: 0.5, whole: false });
  assert.deepEqual(r.effects[0].tokens, []);
  assert.equal(r.effects[0].mod, null);
  assert.equal(r.effects[1].lfo, null);

  for (const bad of [
    '/* a */ s("bd").lpf(sine2)',
    '/* a */ s("bd").lpf(sine2.mul(400).segment(4))',
    '/* a */ s("bd").lpf(sine2.mul(0).add(800).segment(4))',
    '/* a */ s("bd").lpf(sine2.early(1).mul(400).add(800).segment(4))',
    '/* a */ s("bd").lpf(sine2.mul(400).add(800).segment(4).fast(2))',
    '/* a */ s("bd").lpf(perlin2.mul(400).add(800).segment(4))',
  ]) assert.ok(!codeToTrack(bad).ok, bad);
});

test('code: Paramlocks (.up("…".as("…"))) einer Klangspur hin und zurück', () => {
  assert.equal(
    roundTrip('/* d */ s("bd").up( "1 ~ [.7:4:sd .5]" .as( \'velocity:n:s\' ) ).lpf(800)'),
    '/* d */ s("bd").lpf(800).up("1 ~ [.7:4:sd .5]".as("velocity:n:s"))',
  );
  const r = codeToTrack('s("bd").up("1 .5:4".as("velocity:n"))');
  assert.ok(r.ok);
  assert.deepEqual(r.locks?.params, ['velocity', 'n']);
  const ok = codeToTrack('s("bd")');
  assert.ok(ok.ok && ok.locks === null);
  for (const [code, message] of [
    ['s("bd").up("1:4:sd".as("velocity:n"))', /passt nicht zu 2 Parametern/],
    ['s("bd").up("1".as("fast"))', /«fast» lässt sich nicht sperren/],
    ['s("bd").up("1")', /Paramlocks sind/],
    ['s("bd").up("1".as("gain")).up("1".as("gain"))', /nur einmal/],
    ['note("c").up("1".as("gain"))', /nur in Klangspuren/],
    ['s("bd").up("1".as("gain")).midi()', /\.up\(\) gibt es nicht mit \.midi\(\)/],
  ] as const) {
    const bad = codeToTrack(code);
    assert.ok(!bad.ok, code);
    assert.match(bad.message, message, code);
  }
});
