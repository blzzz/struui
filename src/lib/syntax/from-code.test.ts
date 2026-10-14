import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackToCode } from '../domain/codegen.ts';
import { codeToTrack } from './from-code.ts';

function roundTrip(code: string): string {
  const r = codeToTrack(code);
  assert.ok(r.ok, `${code} ist gültig${r.ok ? '' : `: ${r.message}`}`);
  return trackToCode(r).text;
}

test('code: ganze Zeile mit Name, Stummschaltung und Effekten wird zur Spur und zurück', () => {
  const cases: [string, string][] = [
    ['$: s("bd sd")', '$: s("bd sd")'],
    ['$drums: s("bd  hh*2").lpf(800)', '$drums: s("bd hh*2").lpf(800)'],
    ['_$bass : sound(\'bd\') .room( .5 ) .vowel("<a e>")', '_$bass: s("bd").room(0.5).vowel("<a e>")'],
    ['$x: s("bd").lpf("<200 [400 800]>?").cutoff(-1)', '$x: s("bd").lpf("<200 [400 800]>?").cutoff(-1)'],
    ['$: s("")', '$: s("")'],
    ['$a: s("bd").postgain(.5).lpf(800)', '$a: s("bd").lpf(800).postgain(0.5)'],
    ['$a: s("bd").postgain(1)', '$a: s("bd")'],
    ['$a: s("bd").orbit(2).postgain(.5)', '$a: s("bd").orbit(2).postgain(0.5)'],
    ['$a: s("bd").orbit(1)', '$a: s("bd")'],
    ['$m: s("bd").note("c4 e4").midi()', '$m: s("bd").note("c4 e4").midichan(1).midi()'],
    ['$m: s("bd").midichan(10).ccv(.5).midi("IAC Driver Bus 1")', `$m: s("bd").ccv(0.5).midichan(10).midi('IAC Driver Bus 1')`],
    [`$m: s("bd").midi('Bob\\'s')`, `$m: s("bd").midichan(1).midi('Bob\\'s')`],
    ['$n: note("f d").s("sine")', '$n: note("f d").s("sine")'],
    ['$n: note("<c e> g").lpf(800).sound("<sine sawtooth>").orbit(2)', '$n: note("<c e> g").s("<sine sawtooth>").lpf(800).orbit(2)'],
    ['$n: note("c")', '$n: note("c")'],
    ['$n: note("f d" .add("<0 3>").div( 2 )).s("sine")', '$n: note("f d".add("<0 3>").div(2)).s("sine")'],
  ];
  for (const [input, expected] of cases) assert.equal(roundTrip(input), expected, input);
});

test('code: Effekte werden zu Wertsteinen', () => {
  const r = codeToTrack('$a: s("bd").lpf("<200 800>")');
  assert.ok(r.ok);
  assert.equal(r.name, 'a');
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
  assert.equal(at('s("bd")'), 0, 'ohne $');
  assert.equal(at('$a: s("bd").foo(1)'), 12, 'unbekannter Effekt');
  assert.equal(at('$a: s("bd [sd")'), 13, 'Mini-Notation: fehlende ] am Ende, Stelle in der Zeile');
  assert.equal(at('$a_: s("bd")'), 0, '_ am Ende schaltet stumm, nicht als Name');
  assert.equal(at('$a: s("bd").lpf(800'), 19, 'Klammer fehlt');
  assert.equal(at('$a: s("bd").postgain("<1 .5>")'), 21, 'Lautstärke nur als Zahl');
  assert.equal(at('$a: s("bd").orbit(9)'), 18, 'Orbit 1–8');
  assert.equal(at('$a: s("bd").midichan(2)'), 12, 'Kanal nur mit .midi()');
  assert.equal(at('$a: s("bd").orbit(2).midi()'), 12, 'Orbit nicht bei MIDI');
  assert.equal(at('$a: s("bd").midi().lpf(800)'), 18, 'nach .midi() nichts mehr');
  assert.equal(at('$a: s("bd").midichan(17).midi()'), 21, 'Kanal 1–16');
  assert.equal(at('$a: s("bd").s("sine")'), 12, '.s() nur bei Notenspuren');
  assert.equal(at('$a: note("c").s("a").s("b")'), 21, '.s() nur einmal');
  assert.equal(at('$a: note("c").midi()'), 14, 'Notenspuren gehen nicht an MIDI');
  assert.equal(at('$a: n("c")'), 4, 'n() ist keine Spur');
  assert.equal(at('$a: s("bd".add(1))'), 10, 'Rechnen nur in note()');
  assert.equal(at('$a: note("c".foo(1))'), 13, 'unbekannte Rechenart');
  assert.equal(at('$a: note("c".lpf(1))'), 13, 'Effekte nicht an der Mini-Notation');
});

test('code: MIDI-Spur mit Kanal und Ausgang', () => {
  const r = codeToTrack(`$m: s("bd").midichan(3).midi('Bob\\'s Port')`);
  assert.ok(r.ok);
  assert.equal(r.type, 'midi');
  assert.equal(r.channel, 3);
  assert.equal(r.port, "Bob's Port");
  const s = codeToTrack('$a: s("bd").orbit(4)');
  assert.ok(s.ok);
  assert.equal(s.type, 'sound');
  assert.equal(s.orbit, 4);
});

test('code: Notenspur mit Klang in .s()', () => {
  const r = codeToTrack('$n: note("f d").s("sine")');
  assert.ok(r.ok);
  assert.equal(r.type, 'note');
  assert.deepEqual(r.tokens.map((t) => (t.kind === 'sound' ? t.sound : t.kind)), ['f', 'd']);
  assert.deepEqual(r.voice?.tokens.map((t) => (t.kind === 'sound' ? t.sound : t.kind)), ['sine']);
  const none = codeToTrack('$n: note("f")');
  assert.ok(none.ok);
  assert.equal(none.voice, null);
});
