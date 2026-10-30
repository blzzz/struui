// Prüft mit dem echten Strudel (ohne Browser), dass der erzeugte Code läuft und dass die von Strudel
// gemeldeten Zeichenpositionen auf die richtigen Steine zeigen. Kein Audio, keine Samples.
// Aufruf: npm run test:strudel
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'vite';

/**
 * Tonal.js (von `@strudel/tonal`) verweist mit `main` auf CommonJS-Dateien, die zum Teil fehlen (`@tonaljs/abc-notation`).
 * Der Browser nimmt `module`; hier dasselbe: jedes `@tonaljs/…` als `dist/index.mjs`.
 */
const tonalEsm = {
  name: 'tonaljs-esm',
  enforce: 'pre',
  async resolveId(id, importer) {
    if (!id.startsWith('@tonaljs/')) return null;
    const r = await this.resolve(id, importer, { skipSelf: true });
    const mjs = r?.id.replace(/index\.c?js$/, 'index.mjs');
    return mjs && existsSync(mjs) ? mjs : r;
  },
};

const server = await createServer({
  configFile: false,
  plugins: [tonalEsm],
  logLevel: 'error',
  server: { middlewareMode: true },
  ssr: { noExternal: [/^@strudel\//, /^@kabelsalat\//, /^@tonaljs\//] },
  appType: 'custom',
});

try {
  const core = await server.ssrLoadModule('@strudel/core');
  const mini = await server.ssrLoadModule('@strudel/mini');
  const transpiler = await server.ssrLoadModule('@strudel/transpiler');
  const types = await server.ssrLoadModule('/src/lib/domain/types.ts');
  const codegen = await server.ssrLoadModule('/src/lib/domain/codegen.ts');
  const fromCode = await server.ssrLoadModule('/src/lib/syntax/from-code.ts');
  const fromProgram = await server.ssrLoadModule('/src/lib/syntax/from-program.ts');
  const effects = await server.ssrLoadModule('/src/lib/domain/effects.ts');
  // Nur die Tonleitern (transpose, scale), nicht voicings.mjs: das braucht chord-voicings, nur als CommonJS verpackt
  const tonal = await server.ssrLoadModule('@strudel/tonal/tonal.mjs');

  await core.evalScope(core, mini, tonal);
  mini.miniAllStrings?.();
  // Funktionen, die sonst die Strudel-Oberfläche liefert
  globalThis.setcps = () => {};
  globalThis.setcpm = () => {};
  // Der Code endet mit stack(…): ohne Label spielt Strudel den letzten Ausdruck, wie in der Engine
  const patterns = [];
  const run = async (code) => {
    const { pattern } = await transpiler.evaluate(code);
    assert.ok(pattern instanceof core.Pattern, 'der Code ergibt ein Muster');
    patterns.push(pattern);
  };

  const { soundToken: snd, openToken: open, closeToken: close } = types;
  const tracks = [
    [
      snd('bd'),
      snd('hh', { repeat: { op: '*', value: 4 } }),
      open('['),
      snd('sd'),
      snd('oh'),
      // Stapel mit Komma: [oh, cp*2]
      snd('cp', { joined: true, repeat: { op: '*', value: 2 } }),
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
  assert.match(code, /\nstack\(\n {2}\/\* drums \*\/ s\(".*"\)\.lpf\("<200 800>"\)\.room\(0\.5\),\n {2}s\(/, 'Name und Effekte stehen im Code');
  assert.match(code, /\n {2}s\("[^"]*"\)\.postgain\(0\.8\)\n\)$/, 'Lautstärke steht am Ende der Spur');
  const owner = new Map();
  for (const t of [...tracks.flat(), lo, hi]) owner.set(t.id, t);
  const values = new Set([lo.id, hi.id]);

  await run(code);
  assert.equal(patterns.length, 1, 'beide Spuren in einem stack');

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
    assert.match(program.code, /\/\* mel \*\/ note\("f <d a4> ~ c#3\*2"\)\.s\("<sine sawtooth>"\)\.orbit\(2\)\n\)$/, 'Notenspur im Code');
    await run(program.code);
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

  // Fremder Code in der Code-Ansicht: gelesen, wieder erzeugt und von Strudel gespielt. Der Rahmen (Code davor, `.room` am
  // Stapel) bleibt, der rohe Eintrag klingt, und die Steine der verstandenen Spur leuchten trotz des Codes davor richtig.
  {
    patterns.length = 0;
    const foreign = 'const lead = s("cp*2")\nsetcpm(120/4)\n\nstack(\n  /* drums */ s("bd hh"),\n  lead.fast(1)\n).room(.2)';
    const read = fromProgram.programToTracks(foreign);
    assert.ok(read.ok, read.message);
    assert.deepEqual(read.entries.map((e) => e.kind), ['track', 'raw']);
    const tracks = read.entries.map((e) => (e.kind === 'raw' ? { tokens: [], ...e } : e.line));
    const program = codegen.toStrudelProgram(tracks, { cps: read.tempo.cps, tempoUnit: read.tempo.unit, frame: read.frame });
    assert.ok(program.code.startsWith('setcpm(120/4)\n\nconst lead = s("cp*2")\n\nstack('), program.code);
    await run(program.code);
    const byId = new Map(read.entries[0].line.tokens.map((t) => [t.id, t]));
    const seen = new Set();
    for (const hap of patterns[0].queryArc(0, 2)) {
      assert.equal(hap.value.room, 0.2, 'Aufruf am Stapel fehlt');
      const hits = (hap.context.locations ?? []).flatMap((loc) => program.ranges.filter((r) => loc.start >= r.start && loc.start < r.end));
      if (hap.value.s === 'cp') {
        assert.equal(hits.length, 0, 'roher Code trifft einen Stein');
      } else {
        assert.equal(hits.length, 1, `keine eindeutige Zuordnung für ${hap.value.s}`);
        assert.equal(byId.get(hits[0].tokenId).sound, hap.value.s, 'falscher Stein');
      }
      seen.add(hap.value.s);
    }
    assert.deepEqual([...seen].sort(), ['bd', 'cp', 'hh']);
    console.log('ok: fremder Code mit rohem Eintrag und Rahmen gelesen, gespielt und Steinen richtig zugeordnet');
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
    assert.match(program.code, / {2}s\("bd sd"\)\.lpf\(slider\(800, 100, 8000, 10\)\)\n\)$/, 'slider() im Code');
    await run(program.code);
    const haps = patterns[0].queryArc(0, 1);
    assert.equal(haps.length, 2);
    for (const hap of haps) assert.equal(hap.value.cutoff, 800, 'Wert aus slider() kommt an');
    const back = fromCode.codeToTrack(program.code.split('\n').at(-2).trim());
    assert.ok(back.ok);
    assert.deepEqual(back.effects[0].slider, { min: 100, max: 8000, step: 10 });
    console.log('ok: slider(wert, min, max, step) läuft in Strudel und kommt als Regler zurück');
  }

  // Zufallsreihe: .lpf(rand.range(…).segment(…).ribbon(…)) läuft, bleibt im Bereich, wiederholt sich nach `cycles`
  // Zyklen (ribbon) und kommt als Zufallsreihe zurück. Mit round() ganze Zahlen.
  {
    patterns.length = 0;
    const rand = { min: 200, max: 2000, segments: 4, offset: 7, cycles: 2, ribbon: true, whole: true };
    const fx = [{ ...types.effect('lpf', [snd('800')]), rand }];
    const program = codegen.toStrudelProgram([{ tokens: [snd('hh*8')], effects: fx }], { cps: 0.5 });
    assert.match(program.code, /\.lpf\(rand\.range\(200, 2000\)\.round\(\)\.segment\(4\)\.ribbon\(7, 2\)\)\n\)$/, 'Zufallsreihe im Code');
    await run(program.code);
    const cutoffs = (from, to) => patterns[0].queryArc(from, to).sort((a, b) => a.whole.begin - b.whole.begin).map((h) => h.value.cutoff);
    const first = cutoffs(0, 2);
    assert.equal(first.length, 16);
    for (const c of first) assert.ok(Number.isInteger(c) && c >= 200 && c <= 2000, `Wert ${c} ausserhalb oder nicht ganz`);
    assert.ok(new Set(first).size > 1, 'Zufall fehlt');
    assert.deepEqual(cutoffs(2, 4), first, 'ribbon wiederholt die Reihe');
    const back = fromCode.codeToTrack(program.code.split('\n').at(-2).trim());
    assert.ok(back.ok);
    assert.deepEqual(back.effects[0].rand, rand);
    console.log('ok: Zufallsreihe (rand.range … ribbon) läuft in Strudel, wiederholt sich und kommt zurück');
  }

  // Modulation: jede Welle läuft und bleibt im Bereich; ein Sinus über 2 Zyklen (slow) steigt und fällt, mit segment
  // stufig, und kommt als Modulation zurück.
  {
    for (const wave of effects.WAVES) {
      patterns.length = 0;
      const mod = { wave, min: 200, max: 2000, segments: 8, slow: 2, whole: false };
      const program = codegen.toStrudelProgram([{ tokens: [snd('hh*8')], effects: [{ ...types.effect('lpf'), mod }] }], { cps: 0.5 });
      await run(program.code);
      const haps = patterns[0].queryArc(0, 2).sort((a, b) => a.whole.begin - b.whole.begin);
      assert.equal(haps.length, 16, wave);
      for (const h of haps) assert.ok(h.value.cutoff >= 200 && h.value.cutoff <= 2000, `${wave}: ${h.value.cutoff} ausserhalb`);
      const back = fromCode.codeToTrack(program.code.split('\n').at(-2).trim());
      assert.ok(back.ok, wave);
      assert.deepEqual(back.effects[0].mod, mod, wave);
      if (wave === 'sine') {
        const c = haps.map((h) => h.value.cutoff);
        assert.ok(c[4] > c[0] && c[12] < c[8], `Sinus steigt und fällt: ${c}`);
      }
    }
    console.log(`ok: Modulation mit ${effects.WAVES.length} Wellen läuft in Strudel, bleibt im Bereich und kommt zurück`);
  }

  // LFO: jede Welle läuft und bleibt zwischen Mitte ± Tiefe; ein Sinus um 800 steigt und fällt über 2 Zyklen, die Phase
  // verschiebt ihn um eine Viertelperiode, und er kommt als LFO zurück.
  {
    for (const wave of effects.LFO_WAVES) {
      patterns.length = 0;
      const lfo = { wave, center: 800, depth: 400, segments: 8, slow: 2, phase: 0, whole: false };
      const program = codegen.toStrudelProgram([{ tokens: [snd('hh*8')], effects: [{ ...types.effect('lpf'), lfo }] }], { cps: 0.5 });
      await run(program.code);
      const haps = patterns[0].queryArc(0, 2).sort((a, b) => a.whole.begin - b.whole.begin);
      assert.equal(haps.length, 16, wave);
      for (const h of haps) assert.ok(h.value.cutoff >= 400 && h.value.cutoff <= 1200, `${wave}: ${h.value.cutoff} ausserhalb`);
      const back = fromCode.codeToTrack(program.code.split('\n').at(-2).trim());
      assert.ok(back.ok, wave);
      assert.deepEqual(back.effects[0].lfo, lfo, wave);
      if (wave === 'sine') {
        const c = haps.map((h) => h.value.cutoff);
        assert.ok(c[4] > c[0] && c[12] < c[8], `Sinus steigt und fällt: ${c}`);
        assert.ok(Math.abs(c[0] - 800) < 1, `Sinus beginnt in der Mitte: ${c[0]}`);
        patterns.length = 0;
        const shifted = codegen.toStrudelProgram([{ tokens: [snd('hh*8')], effects: [{ ...types.effect('lpf'), lfo: { ...lfo, phase: 0.25 } }] }], { cps: 0.5 });
        assert.match(shifted.code, /\.early\(0\.25\)/);
        await run(shifted.code);
        const s = patterns[0].queryArc(0, 2).sort((a, b) => a.whole.begin - b.whole.begin).map((h) => h.value.cutoff);
        assert.ok(Math.abs(s[0] - 1200) < 1, `Viertelperiode früher beginnt der Sinus oben: ${s[0]}`);
      }
    }
    console.log(`ok: LFO mit ${effects.LFO_WAVES.length} Wellen läuft in Strudel, bleibt um die Mitte und kommt zurück`);
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
    assert.match(program.code, / {2}note\("c3 e3"\.add\("<0 12>"\)\)\.s\("sine"\)\n\)$/, 'Rechenart im Code');
    await run(program.code);
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

  // Sample-Funktionen: s("brk").fit().chop(2).scrub("<0 .5>") läuft, scrub setzt begin, und seine Wertsteine leuchten
  {
    patterns.length = 0;
    const brk = snd('brk');
    const zero = snd('0');
    const half = snd('.5');
    const fx = [types.effect('fit'), types.effect('chop', [snd('2')]), types.effect('scrub', [open('<'), zero, half, close('<')])];
    const program = codegen.toStrudelProgram([{ tokens: [brk], effects: fx }], { cps: 0.5 });
    assert.match(program.code, / {2}s\("brk"\)\.fit\(\)\.chop\(2\)\.scrub\("<0 \.5>"\)\n\)$/, 'Sample-Funktionen im Code');
    await run(program.code);
    for (const [cycle, stone, begin] of [[0, zero, 0], [1, half, 0.5]]) {
      const haps = patterns[0].queryArc(cycle, cycle + 1);
      assert.equal(haps.length, 2, `Zyklus ${cycle}: chop(2) teilt in zwei`);
      for (const hap of haps) {
        assert.equal(hap.value.begin, begin, `Zyklus ${cycle}: scrub setzt begin`);
        const lit = hap.context.locations.flatMap((loc) => program.ranges.filter((r) => loc.start >= r.start && loc.start < r.end)).map((r) => r.tokenId);
        assert.ok(lit.includes(brk.id), `Zyklus ${cycle}: Klangstein leuchtet`);
        assert.ok(lit.includes(stone.id), `Zyklus ${cycle}: Wertstein von scrub leuchtet`);
      }
    }
    console.log('ok: Sample-Funktionen (fit, chop, scrub) laufen in Strudel, Klang- und Wertsteine leuchten');
  }

  // Musterbefehle: jeder aus der Effektliste (Gruppen pattern, random, tonal) läuft mit seinem Startwert, Tonhöhen in einer
  // Notenspur, ohne Fehler im Log (Strudel wirft manche nicht, sondern meldet sie dort). scale kennt jede Tonleiter der Auswahl.
  {
    const ops = effects.EFFECTS.filter((e) => ['pattern', 'random', 'tonal'].includes(e.group));
    assert.ok(ops.length > 30, 'zu wenige Musterbefehle');
    const play = async (track) => {
      patterns.length = 0;
      const program = codegen.toStrudelProgram([track], { cps: 0.5 });
      const logged = [];
      const log = console.log;
      console.log = (...args) => logged.push(args.join(' '));
      try {
        await run(program.code);
        return { haps: patterns[0].queryArc(0, 4), errors: logged.filter((m) => /error/i.test(m)), code: program.code };
      } finally {
        console.log = log;
      }
    };
    const noteTrack = (fx) => ({ type: 'note', tokens: [snd('c'), snd('e'), snd('g')], voice: { tokens: [snd('piano')] }, effects: fx });
    for (const info of ops) {
      const start = effects.defaultValue(info) ?? '1';
      const fx = [info.noValue ? types.effect(info.name) : types.effect(info.name, [snd(start)])];
      // scaleTranspose verschiebt innerhalb einer Tonleiter: ohne scale davor meldet Strudel einen Fehler
      if (info.name === 'scaleTranspose') fx.unshift(types.effect('scale', [snd('C:major')]));
      const track = info.group === 'tonal' ? noteTrack(fx) : { tokens: [snd('bd'), snd('sd'), snd('hh')], effects: fx };
      const { haps, errors, code } = await play(track);
      assert.deepEqual(errors, [], `${info.name}: ${code}`);
      assert.ok(haps.length > 0, `${info.name} spielt nichts: ${code}`);
    }
    const [, scaleTypes] = effects.effectInfo('scale').parts;
    for (const type of scaleTypes) {
      const { haps, errors, code } = await play(noteTrack([types.effect('scale', [snd(`F#:${type}`)])]));
      assert.deepEqual(errors, [], code);
      assert.ok(haps.length > 0 && haps.every((h) => /^[A-G][#b]*\d$/.test(h.value.note)), `${type}: ${code}`);
    }
    // transpose mit Intervall und Halbtönen, im Wechsel je Zyklus (queryArc liefert nicht zeitlich sortiert)
    const { haps } = await play(noteTrack([types.effect('transpose', [open('<'), snd('3M'), snd('-2'), close('<')])]));
    assert.deepEqual(haps.filter((h) => h.hasOnset()).sort((a, b) => a.whole.begin.valueOf() - b.whole.begin.valueOf()).map((h) => h.value.note), ['E', 'G#', 'B', 'Bb', 'D', 'F', 'E', 'G#', 'B', 'Bb', 'D', 'F']);
    console.log(`ok: ${ops.length} Musterbefehle und ${scaleTypes.length} Tonleitern laufen in Strudel`);
  }

  // struct: die Struktur bestimmt die Ereignisse, und der x-Stein, der ein Ereignis auslöst, leuchtet
  {
    patterns.length = 0;
    const hits = [snd('x'), snd('x')];
    const structure = [hits[0], snd('~'), hits[1], snd('~')];
    const program = codegen.toStrudelProgram([{ tokens: [snd('bd')], effects: [types.effect('struct', structure)] }], { cps: 0.5 });
    await run(program.code);
    const haps = patterns[0].queryArc(0, 1);
    assert.deepEqual(haps.map((h) => h.whole.begin.valueOf()), [0, 0.5], 'Ereignisse auf den x-Steinen');
    haps.forEach((hap, i) => {
      const ids = (hap.context.locations ?? []).flatMap((loc) => program.ranges.filter((r) => loc.start >= r.start && loc.start < r.end).map((r) => r.tokenId));
      assert.ok(ids.includes(hits[i].id), `x-Stein ${i} leuchtet nicht`);
    });
    console.log('ok: struct setzt die Ereignisse, die x-Steine leuchten');
  }

  // Sampler-Spur: s("<brk amen>").slice(4, "0 <1 3>") spielt die Abschnitte (begin/end), scrub die Positionen,
  // und Sample- wie Wertsteine leuchten im richtigen Zyklus.
  {
    const brk = snd('brk');
    const amen = snd('amen');
    const zero = snd('0');
    const one = snd('1');
    const three = snd('3');
    const sampler = (mode, tokens) => ({
      type: 'sampler',
      samplerMode: mode,
      slices: 4,
      sample: { tokens: [open('<'), brk, amen, close('<')] },
      tokens,
    });
    const lit = (hap, program) =>
      hap.context.locations.flatMap((loc) => program.ranges.filter((r) => loc.start >= r.start && loc.start < r.end)).map((r) => r.tokenId);

    patterns.length = 0;
    let program = codegen.toStrudelProgram([sampler('slice', [zero, open('<'), one, three, close('<')])], { cps: 0.5 });
    assert.match(program.code, / {2}s\("<brk amen>"\)\.slice\(4, "0 <1 3>"\)\n\)$/, 'slice im Code');
    await run(program.code);
    const sliceExpected = [
      ['brk', [0, 0.25], [0.25, 0.5]],
      ['amen', [0, 0.25], [0.75, 1]],
    ];
    for (const cycle of [0, 1]) {
      const haps = patterns[0].queryArc(cycle, cycle + 1).sort((a, b) => a.whole.begin - b.whole.begin);
      const [name, ...spans] = sliceExpected[cycle];
      assert.deepEqual(haps.map((h) => [h.value.begin, h.value.end]), spans, `Zyklus ${cycle}: Abschnitte`);
      const stones = cycle === 0 ? [zero, one] : [zero, three];
      haps.forEach((hap, i) => {
        assert.equal(hap.value.s, name, `Zyklus ${cycle}: Sample`);
        const ids = lit(hap, program);
        assert.ok(ids.includes(cycle === 0 ? brk.id : amen.id), `Zyklus ${cycle}: Samplestein leuchtet`);
        assert.ok(ids.includes(stones[i].id), `Zyklus ${cycle}: Abschnittsstein ${i} leuchtet`);
      });
    }

    patterns.length = 0;
    const quarter = snd('.25');
    program = codegen.toStrudelProgram([sampler('scrub', [zero, quarter])], { cps: 0.5 });
    assert.match(program.code, / {2}s\("<brk amen>"\)\.scrub\("0 \.25"\)\n\)$/, 'scrub im Code');
    await run(program.code);
    const haps = patterns[0].queryArc(0, 1).sort((a, b) => a.whole.begin - b.whole.begin);
    assert.deepEqual(haps.map((h) => h.value.begin), [0, 0.25], 'scrub setzt die Position');
    haps.forEach((hap, i) => {
      const ids = lit(hap, program);
      assert.ok(ids.includes(brk.id), 'Samplestein leuchtet');
      assert.ok(ids.includes([zero, quarter][i].id), `Positionsstein ${i} leuchtet`);
    });
    console.log('ok: Sampler-Spur spielt Abschnitte (slice) und Positionen (scrub), Sample- und Wertsteine leuchten');

    // Doppelpunkt: scrub liest danach die Geschwindigkeit, ein Klangstein seine Variante (`bd:3` = n 3)
    patterns.length = 0;
    const fast = snd('.5:2');
    program = codegen.toStrudelProgram([sampler('scrub', [fast])], { cps: 0.5 });
    assert.match(program.code, /\.scrub\("\.5:2"\)\n\)$/, 'scrub mit Geschwindigkeit im Code');
    await run(program.code);
    const [scrubbed] = patterns[0].queryArc(0, 1);
    assert.equal(scrubbed.value.begin, 0.5, 'scrub: Position vor dem Doppelpunkt');
    assert.equal(scrubbed.value.speed, 2, 'scrub: Geschwindigkeit nach dem Doppelpunkt');
    assert.ok(lit(scrubbed, program).includes(fast.id), 'Wertstein mit Geschwindigkeit leuchtet');

    patterns.length = 0;
    const bd3 = snd('bd:3');
    const hh = snd('hh');
    program = codegen.toStrudelProgram([{ tokens: [bd3, hh] }], { cps: 0.5 });
    await run(program.code);
    const variants = patterns[0].queryArc(0, 1).sort((a, b) => a.whole.begin - b.whole.begin);
    assert.deepEqual(variants.map((h) => [h.value.s, h.value.n]), [['bd', 3], ['hh', undefined]], 'Variante wird n');
    // `bd:3` meldet zwei Positionen (Name und Zahl), beide im selben Stein
    variants.forEach((hap, i) => assert.deepEqual([...new Set(lit(hap, program))], [[bd3, hh][i].id], `Klangstein ${i} leuchtet allein`));
    console.log('ok: Doppelpunkt: scrub mit Geschwindigkeit, Klangstein mit Variante, beide leuchten');
  }

  // Namen als Kommentar und Stummschaltung: die stumme Spur (.hush()) schweigt, die andere spielt und leuchtet,
  // und jede Zeile im stack wird wieder zur Spur mit Name und Stummschaltung
  {
    patterns.length = 0;
    const kick = snd('bd');
    const snare = snd('sd');
    const program = codegen.toStrudelProgram(
      [{ tokens: [kick], name: 'drums' }, { tokens: [snare], name: 'snare', muted: true }],
      { cps: 0.5 },
    );
    assert.match(program.code, /\nstack\(\n {2}\/\* drums \*\/ s\("bd"\),\n {2}\/\* snare \*\/ s\("sd"\)\.hush\(\)\n\)$/, 'stack im Code');
    await run(program.code);
    const haps = patterns[0].queryArc(0, 2);
    assert.deepEqual(haps.map((h) => h.value.s), ['bd', 'bd'], 'nur die nicht stumme Spur klingt');
    for (const hap of haps) {
      const ids = hap.context.locations.flatMap((loc) => program.ranges.filter((r) => loc.start >= r.start && loc.start < r.end));
      assert.deepEqual(ids.map((r) => r.tokenId), [kick.id], 'der Kommentar verschiebt die Positionen nicht');
    }
    const back = program.code.split('\n').slice(-3, -1).map((line) => fromCode.codeToTrack(line.trim().replace(/,$/, '')));
    assert.deepEqual(back.map((r) => r.ok && [r.name, r.muted]), [['drums', false], ['snare', true]], 'Rückweg aus dem stack');
    console.log('ok: Namen als Kommentar, stumme Spur mit .hush() schweigt, Rückweg liest Name und Stummschaltung');
  }

  // Arrangement: Szenen als Variablen, dann arrange(). Abschnitte laufen nacheinander, nur die angezeigte Szene leuchtet.
  {
    patterns.length = 0;
    const a = [snd('bd'), snd('sd')];
    const b = [snd('hh', { repeat: { op: '*', value: 2 } })];
    const program = codegen.toArrangedProgram(
      [
        { id: 'A', variable: 'Szene01', tracks: [{ tokens: a, name: 'drums' }] },
        { id: 'B', variable: 'Szene02', tracks: [{ tokens: b }] },
        { id: 'C', variable: 'Leer', tracks: [] },
      ],
      [
        { sceneId: 'A', times: 2 },
        { sceneId: 'B', times: 1 },
        { sceneId: 'C', times: 1 },
      ],
      { cps: 0.5, lit: 'B' },
    );
    await run(program.code);
    const sounds = (cycle) =>
      patterns[0]
        .queryArc(cycle, cycle + 1)
        .filter((h) => h.hasOnset())
        .map((h) => h.value.s)
        .join(' ');
    assert.deepEqual([0, 1, 2, 3, 4].map(sounds), ['bd sd', 'bd sd', 'hh hh', '', 'bd sd'], 'Abschnitte nacheinander, dann von vorn');
    const lit = patterns[0]
      .queryArc(2, 3)
      .flatMap((h) => (h.context.locations ?? []).flatMap((loc) => program.ranges.filter((r) => loc.start >= r.start && loc.start < r.end)));
    assert.deepEqual(lit.map((r) => r.tokenId), [b[0].id, b[0].id], 'Steine der angezeigten Szene leuchten');
    const dark = patterns[0]
      .queryArc(0, 1)
      .flatMap((h) => (h.context.locations ?? []).flatMap((loc) => program.ranges.filter((r) => loc.start >= r.start && loc.start < r.end)));
    assert.equal(dark.length, 0, 'andere Szenen leuchten nicht');
    patterns.length = 0;
    await run(codegen.toArrangedProgram([{ id: 'A', variable: 'A', tracks: [{ tokens: a }] }], [], { cps: 0.5 }).code);
    assert.equal(patterns[0].queryArc(0, 1).length, 0, 'leeres Arrangement schweigt');
    console.log('ok: Arrangement spielt Szenen nacheinander (arrange), nur die angezeigte Szene leuchtet');
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
      if (r < 0.6) tokens.push(snd(pick(['bd', 'hh', '808bd', 'rim', '~']), { ...mods(), joined: rnd() < 0.25 }));
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
