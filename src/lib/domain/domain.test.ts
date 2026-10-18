import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from './parse.ts';
import { trackToMini, toStrudelCode, toStrudelProgram } from './codegen.ts';
import { adoptIds, insertAt, moveToken, removeAt, replaceAt, stackAt, wrapAt, wrapRange, wrapSpan, insertPair, quickSwitch, setGroup, unwrapAt } from './edit.ts';
import { closeToken, defaultTrackName, openToken, rawToken, soundToken, trackName } from './types.ts';
import type { Token } from './types.ts';

const never = () => 0.99; // Zufall fällt nie aus

test('codegen: einfache Spur mit Stern, Ausrufezeichen und Zufall', () => {
  const tokens: Token[] = [
    soundToken('bd'),
    soundToken('hh', { repeat: { op: '*', value: 4 } }),
    soundToken('sd', { repeat: { op: '!', value: 2 } }),
    soundToken('cp', { random: 0.5 }),
    soundToken('oh', { random: 0.25 }),
    soundToken('~'),
  ];
  assert.equal(trackToMini(tokens), 'bd hh*4 sd!2 cp? oh?0.25 ~');
});

test('codegen: Klammern ohne Leerzeichen innen, Modifier an der schliessenden', () => {
  const tokens: Token[] = [
    soundToken('bd'),
    openToken('['),
    soundToken('hh'),
    soundToken('oh'),
    closeToken('[', { repeat: { op: '*', value: 2 } }),
    openToken('<'),
    soundToken('sd'),
    soundToken('cp'),
    closeToken('<'),
  ];
  assert.equal(trackToMini(tokens), 'bd [hh oh]*2 <sd cp>');
});

test('codegen: Gewicht @ an Klang und Klammer, Modulo an }', () => {
  const tokens: Token[] = [
    soundToken('bd', { repeat: { op: '@', value: 3 }, random: 0.5 }),
    openToken('['),
    soundToken('hh'),
    closeToken('[', { repeat: { op: '@', value: 0.5 } }),
    openToken('{'),
    soundToken('a'),
    soundToken('b'),
    soundToken('c'),
    closeToken('{', { steps: 4 }),
    openToken('{'),
    soundToken('d'),
    closeToken('{'),
  ];
  assert.equal(trackToMini(tokens), 'bd@3? [hh]@0.5 {a b c}%4 {d}');
});

test('codegen: } gibt Zufall und Wiederholung nicht aus, nur den Modulowert', () => {
  const close = closeToken('{', { steps: 3, random: 0.5, repeat: { op: '*', value: 2 } });
  assert.equal(trackToMini([openToken('{'), soundToken('a'), close]), '{a}%3');
  const r = parse([openToken('{'), soundToken('a'), close]);
  const node = r.nodes[0];
  assert.ok(node.type === 'group' && node.steps === 3 && node.mods.repeat === null);
});

test('codegen: * mit Wert 1 erzeugt nichts', () => {
  assert.equal(trackToMini([soundToken('bd', { repeat: { op: '*', value: 1 } })]), 'bd');
});

test('codegen: Aufnahmen werden eingebettet und für die Anzeige gekürzt', () => {
  const tokens: Token[] = [soundToken('rec1')];
  const samples = new Map([['rec1', 'data:audio/wav;base64,AAAA']]);
  const full = toStrudelCode([{ tokens }], { cps: 0.5, samples });
  assert.match(full, /samples\(\{\n {2}rec1: 'data:audio\/wav;base64,AAAA'\n\}\)/);
  const short = toStrudelCode([{ tokens }], { cps: 0.5, samples, elideSamples: true });
  assert.match(short, /base64,… \(/);
  assert.match(full, /\n {2}s\("rec1"\)\n/);
});

test('parse: erkennt Verschachtelung und Tiefe', () => {
  const a = soundToken('a');
  const inner = soundToken('b');
  const tokens: Token[] = [openToken('['), a, openToken('<'), inner, closeToken('<'), closeToken('[')];
  const r = parse(tokens);
  assert.equal(r.errors.length, 0);
  assert.deepEqual(r.depth.get(a.id), ['[']);
  assert.deepEqual(r.depth.get(inner.id), ['[', '<']);
  assert.equal(r.nodes.length, 1);
});

test('parse: meldet fehlende, überzählige und falsche Klammern', () => {
  assert.deepEqual(parse([openToken('['), soundToken('a')]).errors.map((e) => e.code), ['unclosed-open']);
  assert.deepEqual(parse([openToken('['), closeToken('[')]).errors.map((e) => e.code), ['empty-group', 'empty-group']);
  assert.deepEqual(parse([soundToken('a'), closeToken('[')]).errors.map((e) => e.code), ['unmatched-close']);
  const mismatch = parse([openToken('['), soundToken('a'), closeToken('<')]).errors.map((e) => e.code);
  assert.deepEqual(mismatch, ['mismatched-close', 'unclosed-open']);
});

test('codegen: Positionen der Klangnamen zeigen auf die Namen im Code', () => {
  const tokens: Token[] = [
    soundToken('bd'),
    openToken('['),
    soundToken('hh', { repeat: { op: '*', value: 2 } }),
    soundToken('~'),
    soundToken('oh'),
    closeToken('[', { random: 0.25 }),
    soundToken('808bd'),
  ];
  const second: Token[] = [soundToken('cp')];
  const samples = new Map([['rec1', 'data:audio/wav;base64,AAAA']]);
  const { code, ranges } = toStrudelProgram([{ tokens }, { tokens: [soundToken('rec1'), ...second] }], { cps: 0.5, samples });
  const byId = new Map(ranges.map((r) => [r.tokenId, code.slice(r.start, r.end)]));
  const names = tokens.concat(second).filter((t) => t.kind === 'sound' && t.sound !== '~').map((t) => byId.get(t.id));
  assert.deepEqual(names, ['bd', 'hh', 'oh', '808bd', 'cp']);
  assert.equal(ranges.length, 6); // plus rec1
  assert.ok([...byId.values()].includes('rec1'));
});

test('edit: Paar einfügen, Stein umschliessen, verschieben', () => {
  const a = soundToken('a');
  const b = soundToken('b');
  const tokens: Token[] = [a, b];
  wrapAt(tokens, 0, '[');
  assert.equal(trackToMini(tokens), '[a] b');
  insertPair(tokens, 3, '<');
  assert.equal(trackToMini(tokens), '[a] <~> b');
  const list: Token[] = [soundToken('x'), soundToken('y'), soundToken('z')];
  moveToken(list, 0, list, 3);
  assert.equal(trackToMini(list), 'y z x');
});

test('edit: von Stein bis Stein umschliessen, auch rückwärts', () => {
  const tokens: Token[] = ['a', 'b', 'c', 'd'].map((x) => soundToken(x));
  wrapRange(tokens, 1, 2, '<');
  assert.equal(trackToMini(tokens), 'a <b c> d');
  wrapRange(tokens, 5, 0, '[');
  assert.equal(trackToMini(tokens), '[a <b c> d]');
});

test('edit: Bereich nimmt angeschnittene Klammerpaare ganz mit', () => {
  // a [b c] d
  const tokens: Token[] = [soundToken('a'), openToken('['), soundToken('b'), soundToken('c'), closeToken('['), soundToken('d')];
  assert.deepEqual(wrapSpan(tokens, 0, 2), [0, 4]);
  assert.deepEqual(wrapSpan(tokens, 3, 5), [1, 5]);
  assert.deepEqual(wrapSpan(tokens, 2, 3), [2, 3]);
  // Von b bis zur schliessenden Klammer: die öffnende kommt dazu
  wrapRange(tokens, 2, 4, '<');
  assert.equal(trackToMini(tokens), 'a <[b c]> d');
});

test('codegen: alle Spuren in einem stack, Namen als Kommentar, stumme Spur mit .hush()', () => {
  const code = toStrudelCode(
    [
      { tokens: [soundToken('bd')], name: 'drums' },
      { tokens: [] },
      { tokens: [soundToken('sd')], muted: true, volume: 0.5 },
      { tokens: [soundToken('cp')], type: 'midi', muted: true, name: 'm' },
    ],
    { cps: 0.5 },
  );
  assert.equal(
    code,
    'setcps(0.5)\n\nstack(\n  /* drums */ s("bd"),\n  s("sd").postgain(0.5).hush(),\n  /* m */ s("cp").midichan(1).midi().hush()\n)',
  );
  assert.equal(toStrudelCode([{ tokens: [] }], { cps: 0.5 }), 'setcps(0.5)\n', 'ohne Steine kein stack');
});

test('name: Standardname aus der Art mit der ersten freien Nummer', () => {
  assert.equal(defaultTrackName('sound', []), 'Klangspur_1');
  assert.equal(defaultTrackName('sound', ['Klangspur_1', 'Klangspur_3', 'Notenspur_2']), 'Klangspur_2');
  assert.equal(defaultTrackName('note', ['Klangspur_1']), 'Notenspur_1');
  for (const type of ['sound', 'note', 'midi', 'sampler'] as const) {
    const name = defaultTrackName(type, []);
    assert.equal(trackName(name), name, `${name} ist ein gültiger Name`);
  }
});

test('edit: Einzeltippen auf eine Klammer tauscht das ganze Paar', () => {
  const tokens: Token[] = [
    openToken('['),
    soundToken('a'),
    openToken('['),
    soundToken('b'),
    closeToken('['),
    closeToken('[', { repeat: { op: '*', value: 2 } }),
  ];
  quickSwitch(tokens, 0);
  assert.equal(trackToMini(tokens), '<a [b]>*2');
  quickSwitch(tokens, 4);
  assert.equal(trackToMini(tokens), '<a <b>>*2');
  // Weiter zu { }: die Wiederholung bleibt gespeichert, } gibt sie aber nicht aus
  quickSwitch(tokens, 0);
  assert.equal(trackToMini(tokens), '{a <b>}');
  quickSwitch(tokens, 5);
  assert.equal(trackToMini(tokens), '[a <b>]*2');
  // Ohne Gegenstück wechselt nur die Klammer selbst
  const lone: Token[] = [soundToken('a'), closeToken('[')];
  quickSwitch(lone, 1);
  assert.equal(trackToMini(lone), 'a>');
});

test('raw: roher Stein wird unverändert ausgegeben und leuchtet als Ganzes', () => {
  const raw = rawToken('bd(3,8)');
  const tokens: Token[] = [soundToken('hh'), raw];
  const { code, ranges } = toStrudelProgram([{ tokens }], { cps: 0.5 });
  assert.match(code, /s\("hh bd\(3,8\)"\)/);
  const r = ranges.find((x) => x.tokenId === raw.id);
  assert.equal(r && code.slice(r.start, r.end), 'bd(3,8)');
  assert.equal(parse(tokens).errors.length, 0);
  quickSwitch(tokens, 1);
  assert.equal(trackToMini(tokens), 'hh bd(3,8)');
});

test('edit: neue Steine übernehmen IDs gleichartiger Steine an gleicher Stelle', () => {
  const old: Token[] = [soundToken('a'), openToken('['), soundToken('b')];
  const next: Token[] = [soundToken('x'), soundToken('y'), soundToken('b')];
  adoptIds(old, next);
  assert.equal(next[0].id, old[0].id);
  assert.notEqual(next[1].id, old[1].id);
  assert.equal(next[2].id, old[2].id);
});

test('edit: Klammerpaar auflösen behält den Inhalt, Klammerart gilt für beide', () => {
  const tokens: Token[] = [soundToken('bd'), openToken('['), soundToken('hh'), soundToken('oh'), closeToken('['), soundToken('sd')];
  setGroup(tokens, 4, '<');
  assert.equal(trackToMini(tokens), 'bd <hh oh> sd');
  unwrapAt(tokens, 1);
  assert.equal(trackToMini(tokens), 'bd hh oh sd');
  const lonely: Token[] = [soundToken('bd'), closeToken('[')];
  unwrapAt(lonely, 1);
  assert.equal(trackToMini(lonely), 'bd');
});

const joined = (sound: string) => soundToken(sound, { joined: true });

test('stapel: verbundene Klangsteine stehen mit Komma in Klammern', () => {
  const tokens: Token[] = [soundToken('bd'), joined('hh'), soundToken('sd', { repeat: { op: '*', value: 2 } }), joined('cp')];
  assert.equal(trackToMini(tokens), '[bd, hh] [sd*2, cp]');
  // Nach einer Klammer gilt das Komma nicht
  assert.equal(trackToMini([openToken('<'), joined('a'), soundToken('b'), closeToken('<')]), '<a b>');
  const { ranges } = toStrudelProgram([{ tokens }], { cps: 0.5 });
  const code = toStrudelCode([{ tokens }], { cps: 0.5 });
  assert.deepEqual(ranges.map((r) => code.slice(r.start, r.end)), ['bd', 'hh', 'sd', 'cp']);
});

test('stapel: anfügen, dazwischen einfügen, ersetzen', () => {
  const tokens: Token[] = [soundToken('bd'), soundToken('sd')];
  stackAt(tokens, 0, soundToken('hh'));
  assert.equal(trackToMini(tokens), '[bd, hh] sd');
  // Zwischen zwei Steinen des Stapels: in den Stapel
  insertAt(tokens, 1, soundToken('cp'));
  assert.equal(trackToMini(tokens), '[bd, cp, hh] sd');
  // Vor dem ersten und nach dem letzten: allein
  insertAt(tokens, 0, soundToken('a'));
  insertAt(tokens, 4, soundToken('b'));
  assert.equal(trackToMini(tokens), 'a [bd, cp, hh] b sd');
  // Ersetzen behält den Platz im Stapel
  replaceAt(tokens, 2, soundToken('rim'));
  assert.equal(trackToMini(tokens), 'a [bd, rim, hh] b sd');
});

test('stapel: entfernen und verschieben', () => {
  const tokens: Token[] = [soundToken('bd'), joined('hh'), joined('cp'), soundToken('sd')];
  removeAt(tokens, 0);
  assert.equal(trackToMini(tokens), '[hh, cp] sd');
  removeAt(tokens, 1);
  assert.equal(trackToMini(tokens), 'hh sd');
  // Der erste Stein bleibt beim Ablegen an seiner eigenen Stelle im Stapel
  const stack: Token[] = [soundToken('bd'), joined('hh'), soundToken('sd')];
  moveToken(stack, 0, stack, 0);
  moveToken(stack, 0, stack, 1);
  assert.equal(trackToMini(stack), '[bd, hh] sd');
  // Herausziehen löst ihn, hineinziehen zwischen zwei Stapelsteine verbindet
  moveToken(stack, 2, stack, 1);
  assert.equal(trackToMini(stack), '[bd, sd, hh]');
  moveToken(stack, 0, stack, 3);
  assert.equal(trackToMini(stack), '[sd, hh] bd');
});

test('stapel: Klammern fassen den ganzen Stapel, ein Paar darin trennt ihn', () => {
  const tokens: Token[] = [soundToken('x'), soundToken('bd'), joined('hh'), soundToken('y')];
  assert.deepEqual(wrapSpan(tokens, 2, 3), [1, 3]);
  const wrapped = [...tokens];
  wrapAt(wrapped, 2, '<');
  assert.equal(trackToMini(wrapped), 'x <[bd, hh]> y');
  const split = [...tokens];
  insertPair(split, 2, '[');
  assert.equal(trackToMini(split), 'x bd [~] hh y');
  unwrapAt(split, 2);
  assert.equal(trackToMini(split), 'x bd ~ hh y');
});

test('codegen: Varianten eigener Aufnahmen laden die Aufnahme', () => {
  const samples = new Map([['rec1', 'data:audio/wav;base64,AA']]);
  const { code } = toStrudelProgram([{ tokens: [soundToken('rec1:2'), soundToken('bd:3')] }], { cps: 0.5, samples });
  assert.match(code, /samples\(\{\n {2}rec1: 'data:audio\/wav;base64,AA'\n\}\)/);
  assert.match(code, /s\("rec1:2 bd:3"\)/);
});
