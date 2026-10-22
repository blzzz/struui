import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toStrudelProgram } from '../domain/codegen.ts';
import type { CodeTrack } from '../domain/codegen.ts';
import { checkExpression, programToTracks, rawLine } from './from-program.ts';
import type { ProgramEntry, ProgramResult } from './from-program.ts';

function read(code: string): Extract<ProgramResult, { ok: true }> {
  const r = programToTracks(code);
  assert.ok(r.ok, `${code} ist gültig${r.ok ? '' : `: ${r.message}`}`);
  return r;
}

/** Kurzform eines Eintrags: Name und Art bzw. roher Code. */
const brief = (e: ProgramEntry): string =>
  e.kind === 'raw' ? `raw ${e.name}${e.muted ? ' (stumm)' : ''}: ${e.code}` : `${e.line.type} ${e.line.name}${e.line.muted ? ' (stumm)' : ''}`;

/** Wie die Code-Ansicht: lesen, als Spuren wieder ausgeben. */
function again(code: string): string {
  const r = read(code);
  const tracks: CodeTrack[] = r.entries.map((e) => (e.kind === 'raw' ? { tokens: [], ...e } : e.line));
  return toStrudelProgram(tracks, { cps: r.tempo?.cps ?? 0.5, tempoUnit: r.tempo?.unit, frame: r.frame }).code;
}

test('program: eigener Code wird gelesen und kommt unverändert wieder', () => {
  const code = 'setcpm(120/4)\n\nstack(\n  /* drums */ s("bd sd").lpf(800),\n  /* Klangspur_1 */ s("hh*8").hush()\n)';
  assert.equal(again(code), code);
  const r = read(code);
  assert.deepEqual(r.entries.map(brief), ['sound drums', 'sound Klangspur_1 (stumm)']);
  assert.deepEqual(r.tempo, { cps: 0.5, unit: 'bpm' });
  assert.deepEqual(r.frame, { before: '', chain: '', after: '' });
});

test('program: Sammelkommentar gibt die Lage her und bleibt nicht im Rahmen', () => {
  const code = 'setcpm(120/4)\n\nstack(\n  /* drums */ s("bd"),\n  /* hats */ s("hh*8")\n)\n\n/* board: drums 0,0; hats 6,-1,8 */';
  const r = read(code);
  assert.deepEqual(r.entries.map(brief), ['sound drums', 'sound hats']);
  assert.deepEqual(
    r.board,
    new Map([
      ['drums', { x: 0, y: 0, w: 5 }],
      ['hats', { x: 6, y: -1, w: 8 }],
    ]),
  );
  assert.deepEqual(r.frame, { before: '', chain: '', after: '' });
  // Auch zwischen eigenem Code, nur der erste gilt
  const mixed = read('const a = 1\n/* board: x 1,1 */\ns("bd")\n// Ende\n/* board: y 2,2 */');
  assert.deepEqual([...(mixed.board ?? [])].map(([n]) => n), ['x']);
  assert.equal(mixed.frame.before, 'const a = 1');
  assert.equal(mixed.frame.after, '\n// Ende');
  assert.equal(read('s("bd")').board, null);
});

test('program: Code rund um den Stapel bleibt stehen, Aufrufe am Stapel auch', () => {
  const code = `await samples('github:tidalcycles/dirt-samples')\nconst lead = n("0 2 4").scale("C:minor")\n\nstack(\n  s("bd"),\n  lead\n).fast(2).room(.3);\n\n// Ende`;
  const r = read(code);
  assert.deepEqual(r.entries.map(brief), ['sound ', 'raw : lead']);
  assert.deepEqual(r.frame, {
    before: `await samples('github:tidalcycles/dirt-samples')\nconst lead = n("0 2 4").scale("C:minor")`,
    chain: '.fast(2).room(.3)',
    after: ';\n\n// Ende',
  });
  const out = again(code);
  assert.equal(again(out), out, 'zweimal gelesen bleibt gleich');
  assert.ok(out.endsWith('stack(\n  s("bd"),\n  lead\n).fast(2).room(.3);\n\n// Ende'), out);
});

test('program: was Strudel-Steine nicht versteht, wird roher Code mit Name und Stummschaltung', () => {
  const r = read('stack(\n  /* mel */ n("0 2").scale("C:minor").hush(),\n  // Kommentar\n  s("bd").jux(rev),\n  ...more\n)');
  assert.deepEqual(r.entries.map(brief), ['raw mel (stumm): n("0 2").scale("C:minor")', 'raw : s("bd").jux(rev)', 'raw : ...more']);
});

test('program: Kommentare vor einem Eintrag geben nur einen erlaubten Namen', () => {
  const r = read('stack(/* die Trommel */ s("bd"), /* hh */ s("hh"))');
  assert.deepEqual(r.entries.map(brief), ['sound ', 'sound hh']);
});

test('program: Ausdrücke mit Label werden Spuren, _ schaltet stumm', () => {
  const r = read('setcps(.6)\n$: s("bd")\nconst x = 1\ndrums: s("hh").lpf(800)\n_$: note("c e")\n_bass: n("0").scale("C:minor")');
  assert.deepEqual(r.entries.map(brief), ['sound ', 'sound drums', 'note  (stumm)', 'raw bass (stumm): n("0").scale("C:minor")']);
  assert.deepEqual(r.tempo, { cps: 0.6, unit: 'cps' });
  assert.equal(r.frame.before, 'const x = 1');
});

test('program: ein einzelner Ausdruck ist eine Spur', () => {
  const r = read('// mein Beat\n/* drums */ s("bd sd")');
  assert.deepEqual(r.entries.map(brief), ['sound drums']);
  assert.equal(r.frame.before, '// mein Beat');
  assert.deepEqual(read('arrange([4, a], [2, b])').entries.map(brief), ['raw : arrange([4, a], [2, b])']);
});

test('program: ohne Ausdruck am Ende keine Spuren, der Code bleibt', () => {
  const r = read('setcpm(30)\nconst a = s("bd")');
  assert.deepEqual(r.entries, []);
  assert.deepEqual(r.tempo, { cps: 0.5, unit: 'cpm' });
  assert.equal(r.frame.before, 'const a = s("bd")');
  assert.deepEqual(read('').entries, []);
});

test('program: Aufnahmen aus der Anzeige (gekürzt) werden weggelassen, andere samples()-Aufrufe nicht', () => {
  const r = read(`samples({\n  rec1: 'data:audio/wav;base64,… (12 kB)'\n})\n\nsetcps(0.5)\n\nsamples({ x: 'https://a/b.wav' })\nstack(s("rec1"))`);
  assert.equal(r.frame.before, `samples({ x: 'https://a/b.wav' })`);
});

test('program: Tempo nur aus Zahlen, sonst bleibt die Zeile im Code', () => {
  assert.deepEqual(read('setcpm(140/4)').tempo, { cps: 140 / 4 / 60, unit: 'bpm' });
  assert.deepEqual(read('setcpm(90/2)').tempo, { cps: 45 / 60, unit: 'cpm' });
  const r = read('setcps(tempo)\nstack(s("bd"))');
  assert.equal(r.tempo, null);
  assert.equal(r.frame.before, 'setcps(tempo)');
});

test('program: Sampler-Spur mit scrub, wenn die Spur gleichen Namens schon eine ist', () => {
  const code = 'stack(/* b */ s("brk").scrub("0 .5"))';
  assert.equal((read(code).entries[0] as { line: { type: string } }).line.type, 'sound');
  const r = programToTracks(code, (name) => (name === 'b' ? 'sampler' : undefined));
  assert.ok(r.ok);
  assert.equal((r.entries[0] as { line: { type: string } }).line.type, 'sampler');
});

test('program: kein gültiges JavaScript ist ein Fehler mit Stelle', () => {
  const r = programToTracks('stack(\n  s("bd"),\n  s("hh"\n)');
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.message.startsWith('Kein gültiges JavaScript'), JSON.stringify(r));
  assert.ok(!r.ok && r.offset > 10);
});

test('program: roher Code einzeln, Name und .hush() werden abgetrennt', () => {
  assert.deepEqual(rawLine(' /* x */ arrange([4, a]).hush( ) '), { name: 'x', muted: true, code: 'arrange([4, a])' });
  assert.deepEqual(rawLine('/* kein Name */ a'), { name: '', muted: false, code: '/* kein Name */ a' });
  assert.deepEqual(checkExpression('s("bd").jux(rev) /* gut */'), { ok: true });
  assert.equal(checkExpression('s("bd") // x').ok, false);
  assert.equal(checkExpression('a, b').ok, false);
  assert.equal(checkExpression('s("bd"').ok, false);
});

test('program: mehrere Stapel werden einer, in der Reihenfolge im Code', () => {
  const code = 'stack(/* a */ s("bd"))\nconst x = 1\nstack(\n  /* b */ s("hh"),\n  stack(/* c */ s("cp"), /* d */ s("rim"))\n).room(.3)';
  const r = read(code);
  assert.deepEqual(r.entries.map(brief), ['sound a', 'sound b', 'sound c', 'sound d']);
  assert.deepEqual(r.frame, { before: 'const x = 1', chain: '.room(.3)', after: '' });
  const out = again(code);
  assert.equal(out.match(/stack\(/g)?.length, 1, out);
  assert.equal(again(out), out, 'zweimal gelesen bleibt gleich');
});

test('program: ein früherer Stapel mit Aufrufen bleibt eine Spur, ein Stapel mit Aufrufen als Eintrag auch', () => {
  const r = read('stack(s("bd"), stack(s("hh")).fast(2))\nstack(s("cp")).fast(2)\nstack(s("rim"))');
  assert.deepEqual(r.entries.map(brief), ['sound ', 'raw : stack(s("hh")).fast(2)', 'raw : stack(s("cp")).fast(2)', 'sound ']);
  assert.equal(r.frame.chain, '');
});

test('program: Label und Stapel zusammen, $: stack(…) gibt seine Einträge her', () => {
  const r = read('$: stack(/* a */ s("bd"), /* b */ s("hh"))\ndrums: stack(s("cp"))\nstack(/* c */ s("rim"))\n/* d */ s("sd")');
  assert.deepEqual(r.entries.map(brief), ['sound a', 'sound b', 'raw drums: stack(s("cp"))', 'sound c', 'sound d']);
  // Der letzte Ausdruck bleibt nicht hinter dem Stapel stehen, sonst spielte Strudel nur ihn
  assert.equal(r.frame.after, '');
});
