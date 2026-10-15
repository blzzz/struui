// Prüft mit dem echten Strudel (ohne Browser), dass der erzeugte Code läuft und dass die von Strudel
// gemeldeten Zeichenpositionen auf die richtigen Steine zeigen. Kein Audio, keine Samples.
// Aufruf: npm run test:strudel
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true },
  ssr: { noExternal: [/^@strudel\//, /^@kabelsalat\//] },
  appType: 'custom',
});

try {
  const core = await server.ssrLoadModule('@strudel/core');
  const mini = await server.ssrLoadModule('@strudel/mini');
  const transpiler = await server.ssrLoadModule('@strudel/transpiler');
  const types = await server.ssrLoadModule('/src/lib/domain/types.ts');
  const codegen = await server.ssrLoadModule('/src/lib/domain/codegen.ts');

  await core.evalScope(core, mini);
  mini.miniAllStrings?.();
  // Funktionen, die sonst die Strudel-Oberfläche liefert
  globalThis.setcps = () => {};
  globalThis.setcpm = () => {};
  const patterns = [];
  core.Pattern.prototype.p = function () {
    patterns.push(this);
    return this;
  };

  const { soundToken: snd, openToken: open, closeToken: close } = types;
  const tracks = [
    [
      snd('bd'),
      snd('hh', { repeat: { op: '*', value: 4 } }),
      open('['),
      snd('sd'),
      snd('oh'),
      close('[', { repeat: { op: '*', value: 2 } }),
      open('<'),
      snd('cp'),
      snd('808bd'),
      close('<'),
      snd('~'),
      snd('rim', { repeat: { op: '!', value: 2 } }),
      open('{'),
      snd('lt'),
      snd('mt'),
      snd('ht', { repeat: { op: '@', value: 2 } }),
      close('{', { steps: 4 }),
    ],
    [snd('perc'), snd('click', { repeat: { op: '*', value: 0.5 } })],
  ];
  // Effekte: eine Zahl, eine Wertreihe mit Wechsel (deren Steine sollen aufleuchten), ein leerer
  const lo = snd('200');
  const hi = snd('800');
  const fx = [
    types.effect('lpf', [open('<'), lo, hi, close('<')]),
    types.effect('room', [snd('.5')]),
    types.effect('delay', []),
  ];
  const { code, ranges } = codegen.toStrudelProgram(
    tracks.map((tokens, i) => ({ tokens, name: i === 0 ? 'drums' : '', effects: i === 0 ? fx : [], volume: i === 1 ? 0.8 : 1 })),
    { cps: 0.5 },
  );
  assert.match(code, /\$drums: s\(".*"\)\.lpf\("<200 800>"\)\.room\(0\.5\)\n\$: s\(/, 'Name und Effekte stehen im Code');
  assert.match(code, /\n\$: s\("[^"]*"\)\.postgain\(0\.8\)$/, 'Lautstärke steht am Ende der Spur');
  const owner = new Map();
  for (const t of [...tracks.flat(), lo, hi]) owner.set(t.id, t);
  const values = new Set([lo.id, hi.id]);

  await transpiler.evaluate(code);
  assert.equal(patterns.length, 2, 'beide Spuren wurden ausgewertet');

  let checked = 0;
  let valueHits = 0;
  for (const pattern of patterns) {
    for (let cycle = 0; cycle < 4; cycle += 1) {
      for (const hap of pattern.queryArc(cycle, cycle + 1)) {
        // Wie die Engine: alle Positionen durchsuchen. Bei `{…}%4` meldet Strudel zuerst die Position der Zahl.
        const locations = hap.context.locations ?? [];
        assert.ok(locations.length > 0, 'Ereignis ohne Position');
        const hits = locations.flatMap((loc) => ranges.filter((r) => loc.start >= r.start && loc.start < r.end));
        const sounds = hits.filter((r) => !values.has(r.tokenId));
        assert.equal(sounds.length, 1, `keine eindeutige Zuordnung für ${JSON.stringify(locations)} (${hap.value.s})`);
        assert.equal(owner.get(sounds[0].tokenId).sound, hap.value.s, 'falscher Stein');
        // Wertsteine: genau der Stein, dessen Wert gerade gilt (lpf heisst in Strudel intern `cutoff`)
        const vals = hits.filter((r) => values.has(r.tokenId));
        if (hap.value.cutoff !== undefined) {
          assert.equal(vals.length, 1, `Wertstein fehlt bei ${JSON.stringify(hap.value)}`);
          assert.equal(Number(owner.get(vals[0].tokenId).sound), hap.value.cutoff, 'falscher Wertstein');
          valueHits += 1;
        } else {
          assert.equal(vals.length, 0, 'Wertstein in fremder Spur');
        }
        checked += 1;
      }
    }
  }
  assert.ok(checked > 20, 'zu wenige Ereignisse geprüft');
  assert.ok(valueHits > 10, 'zu wenige Wertsteine geprüft');
  console.log(`ok: ${checked} Ereignisse in 4 Zyklen korrekt Steinen zugeordnet, davon ${valueHits} mit Wertstein`);

  // Notenspur: note("…").s("…"). Jedes Ereignis muss genau einen Notenstein und genau einen Klangstein treffen.
  {
    patterns.length = 0;
    const notes = [snd('f'), open('<'), snd('d'), snd('a4'), close('<'), snd('~'), snd('c#3', { repeat: { op: '*', value: 2 } })];
    const voice = [open('<'), snd('sine'), snd('sawtooth'), close('<')];
    const program = codegen.toStrudelProgram([{ tokens: notes, type: 'note', voice: { tokens: voice }, name: 'mel', orbit: 2 }], { cps: 0.5 });
    assert.match(program.code, /\$mel: note\("f <d a4> ~ c#3\*2"\)\.s\("<sine sawtooth>"\)\.orbit\(2\)$/, 'Notenspur im Code');
    await transpiler.evaluate(program.code);
    assert.equal(patterns.length, 1, 'Notenspur wurde ausgewertet');
    const byId = new Map([...notes, ...voice].map((t) => [t.id, t]));
    const voiceIds = new Set(voice.map((t) => t.id));
    let noteHits = 0;
    for (let cycle = 0; cycle < 4; cycle += 1) {
      for (const hap of patterns[0].queryArc(cycle, cycle + 1)) {
        const hits = (hap.context.locations ?? []).flatMap((loc) =>
          program.ranges.filter((r) => loc.start >= r.start && loc.start < r.end),
        );
        const n = hits.filter((r) => !voiceIds.has(r.tokenId));
        const v = hits.filter((r) => voiceIds.has(r.tokenId));
        assert.equal(n.length, 1, `Notenstein fehlt bei ${JSON.stringify(hap.value)}`);
        assert.equal(byId.get(n[0].tokenId).sound, hap.value.note, 'falscher Notenstein');
        assert.equal(v.length, 1, `Klangstein fehlt bei ${JSON.stringify(hap.value)}`);
        assert.equal(byId.get(v[0].tokenId).sound, hap.value.s, 'falscher Klangstein');
        assert.equal(hap.value.orbit, 2);
        noteHits += 1;
      }
    }
    assert.ok(noteHits >= 16, 'zu wenige Noten geprüft');
    console.log(`ok: ${noteHits} Noten einer Notenspur korrekt Noten- und Klangsteinen zugeordnet`);
  }

  // Regler: .lpf(slider(…)) wird vom Transpiler zu sliderWithID(…). Das liefert @strudel/codemirror (lädt das Prebake),
  // hier dasselbe Modul. Der Wert muss im Ereignis ankommen; der Rückweg aus Code liest den Bereich wieder.
  {
    patterns.length = 0;
    const { createRequire } = await import('node:module');
    const fromRepl = createRequire(createRequire(import.meta.url).resolve('@strudel/repl/prebake.mjs'));
    const sliders = await server.ssrLoadModule(fromRepl.resolve('@strudel/codemirror/slider.mjs'));
    await core.evalScope(sliders);
    const fx = [{ ...types.effect('lpf', [snd('800')]), slider: { min: 100, max: 8000, step: 10 } }];
    const program = codegen.toStrudelProgram([{ tokens: [snd('bd'), snd('sd')], effects: fx }], { cps: 0.5 });
    assert.match(program.code, /\$: s\("bd sd"\)\.lpf\(slider\(800, 100, 8000, 10\)\)$/, 'slider() im Code');
    await transpiler.evaluate(program.code);
    const haps = patterns[0].queryArc(0, 1);
    assert.equal(haps.length, 2);
    for (const hap of haps) assert.equal(hap.value.cutoff, 800, 'Wert aus slider() kommt an');
    const fromCode = await server.ssrLoadModule('/src/lib/syntax/from-code.ts');
    const back = fromCode.codeToTrack(program.code.split('\n').at(-1));
    assert.ok(back.ok);
    assert.deepEqual(back.effects[0].slider, { min: 100, max: 8000, step: 10 });
    console.log('ok: slider(wert, min, max, step) läuft in Strudel und kommt als Regler zurück');
  }

  // Rechenarten: note("c3 e3".add("<0 12>")) transponiert wirklich (als Methode nach note() täte es das nicht),
  // und die Wertsteine von add leuchten im richtigen Zyklus.
  {
    patterns.length = 0;
    const notes = [snd('c3'), snd('e3')];
    const zero = snd('0');
    const twelve = snd('12');
    const op = types.effect('add', [open('<'), zero, twelve, close('<')]);
    const program = codegen.toStrudelProgram([{ tokens: notes, type: 'note', noteOps: [op], voice: { tokens: [snd('sine')] } }], { cps: 0.5 });
    assert.match(program.code, /\$: note\("c3 e3"\.add\("<0 12>"\)\)\.s\("sine"\)$/, 'Rechenart im Code');
    await transpiler.evaluate(program.code);
    const expected = [[48, 52], [60, 64]];
    for (const cycle of [0, 1]) {
      const haps = patterns[0].queryArc(cycle, cycle + 1).sort((a, b) => a.whole.begin - b.whole.begin);
      assert.deepEqual(haps.map((h) => h.value.note), expected[cycle], `Zyklus ${cycle}: transponiert`);
      for (const hap of haps) {
        const hits = hap.context.locations.flatMap((loc) => program.ranges.filter((r) => loc.start >= r.start && loc.start < r.end));
        const lit = hits.map((r) => r.tokenId);
        assert.ok(lit.includes(cycle === 0 ? zero.id : twelve.id), `Wertstein von add in Zyklus ${cycle}`);
        assert.equal(lit.filter((id) => notes.some((n) => n.id === id)).length, 1, 'genau ein Notenstein');
      }
    }
    console.log('ok: Rechenarten für Noten transponieren, Noten- und Wertsteine leuchten richtig');
  }

  // Zufallsabgleich: Der eigene Klammer-Parser muss dieselben Spuren akzeptieren wie Strudels Grammatik.
  const parser = await server.ssrLoadModule('/src/lib/domain/parse.ts');
  const syntax = await server.ssrLoadModule('/src/lib/syntax/validate.ts');
  const scales = await server.ssrLoadModule('/src/lib/domain/scales.ts');
  const fromText = await server.ssrLoadModule('/src/lib/syntax/from-text.ts');
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const repeats = [
    () => ({ op: '*', value: pick(scales.STAR_VALUES) }),
    () => ({ op: '!', value: pick(scales.BANG_VALUES) }),
    () => ({ op: '@', value: pick(scales.WEIGHT_VALUES) }),
  ];
  const mods = () => ({
    random: rnd() < 0.25 ? pick(scales.RANDOM_VALUES) : null,
    repeat: rnd() < 0.35 ? pick(repeats)() : null,
    steps: rnd() < 0.5 ? pick(scales.STEPS_VALUES) : null,
  });
  const randomTrack = () => {
    const tokens = [];
    const length = 1 + Math.floor(rnd() * 10);
    for (let i = 0; i < length; i += 1) {
      const r = rnd();
      const group = pick(['[', '<', '{']);
      if (r < 0.6) tokens.push(snd(pick(['bd', 'hh', '808bd', 'rim', '~']), mods()));
      else if (r < 0.8) tokens.push(open(group));
      else tokens.push(close(group, mods()));
    }
    return tokens;
  };
  const mismatches = [];
  let valid = 0;
  const runs = 5000;
  for (let i = 0; i < runs; i += 1) {
    const tokens = randomTrack();
    const text = codegen.trackToMini(tokens);
    const own = parser.parse(tokens).errors.length === 0;
    const theirs = syntax.validateMini(text).ok;
    if (theirs) {
      valid += 1;
      // Rückweg: Text zu Steinen muss genau die Steine (ohne rohe) und denselben Text ergeben
      const back = fromText.textToTokens(text);
      assert.ok(back.ok, `Rückweg scheitert: ${text}`);
      assert.ok(!back.tokens.some((t) => t.kind === 'raw'), `roher Stein im Rückweg: ${text}`);
      assert.equal(codegen.trackToMini(back.tokens), text, `Rückweg ändert den Text: ${text}`);
    }
    if (own !== theirs) mismatches.push({ text, own, strudel: theirs });
  }
  assert.deepEqual(mismatches.slice(0, 5), [], `eigener Parser und Strudel sind uneins (${mismatches.length} von ${runs})`);
  assert.ok(valid > 300, 'zu wenige gültige Spuren im Test');
  console.log(`ok: eigener Parser und Strudels Grammatik stimmen bei ${runs} Zufallsspuren überein (${valid} gültig)`);
  console.log(`ok: alle ${valid} gültigen Spuren ergeben als Text wieder dieselben Steine`);
} finally {
  await server.close();
}
