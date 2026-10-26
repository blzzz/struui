// Liest die Effekte aus den JSDoc-Kommentaren von `@strudel/core/controls.mjs`, statt sie abzuschreiben,
// dazu die Sample-Funktionen (`chop`, `fit` …) und die Rechenarten für Noten (`add`, `div` …) aus `@strudel/core/pattern.mjs`,
// die Musterbefehle (`fast`, `struct`, `degradeBy`, `transpose`, `scale` …) aus `@strudel/core` und `@strudel/tonal`
// und die Tonleitern für `scale` aus Tonal.js.
// Aufruf: npm run gen:effects (schreibt src/lib/domain/effects.generated.ts).
// Der Test `effects.test.ts` prüft, dass die Datei zum installierten Strudel passt.
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const core = (file) => fileURLToPath(new URL(`../node_modules/@strudel/core/${file}`, import.meta.url));
export const CONTROLS = core('controls.mjs');
export const PATTERN = core('pattern.mjs');
export const SIGNAL = core('signal.mjs');
export const EUCLID = core('euclid.mjs');
const TONAL_PACKAGE = fileURLToPath(new URL('../node_modules/@strudel/tonal/package.json', import.meta.url));
export const TONAL = join(dirname(TONAL_PACKAGE), 'tonal.mjs');
export const OUTPUT = fileURLToPath(new URL('../src/lib/domain/effects.generated.ts', import.meta.url));

/**
 * Was Strudel als Steuerparameter dokumentiert, aber kein Klangeffekt ist: Klangwahl, Routing und OSC.
 * Das ist ein Filter, keine Liste von Effekten. Neue Effekte in Strudel kommen ohne Zutun dazu.
 * `postgain` (Lautstärke), `orbit` und `midichan`/`midiport` stellt jede Spur selbst ein, deshalb sind sie keine eigenen Effekte.
 * `scrub` steht zwar in controls.mjs, verändert aber das Muster wie `chop`: es kommt über `SAMPLE_OPS` dazu.
 */
const NOT_EFFECTS = new Set(['postgain', 'orbit', 'midichan', 'midiport', 's', 'n', 'bank', 'source', 'label', 'bus', 'channel', 'channels', 'as', 'dictionary', 'mode', 'anchor', 'chord', 'unit', 'duration', 'control', 'scrub']);
const NOT_EFFECT_PREFIX = /^(sysex|osc|byteBeat)/;

/**
 * Gruppe eines Steuerparameters: `audio` wirkt auf den Klang, `pitch` setzt die Tonhöhe, `midi` geht nur an MIDI-Geräte.
 * Welche Gruppe eine Spur anbietet, entscheidet `offersEffect` in `effects.ts`.
 */
const PITCH = new Set(['note']);
const MIDI_PREFIX = /^(midi|cc|nrp|prog)/;
/**
 * Funktionen, die Samples zerschneiden oder strecken. Im Code nach dem Muster wie Effekte (`s("brk").chop(4)`), aber sie
 * verändern die Ereignisse statt einen Wert zu setzen. Eine Auswahl: nur, was höchstens einen Wert nimmt
 * (`slice` und `splice` brauchen zwei). Beschreibung, Beispielwerte und die Zahl der Werte liest das Skript aus Strudel.
 */
const SAMPLE_OPS = ['chop', 'striate', 'scrub', 'loopAt', 'fit'];

/**
 * Wie eine Sampler-Spur ihre Wertsteine spielt: `scrub` (Positionen 0–1) oder `slice` (Abschnittsnummern, dazu die Zahl der
 * Abschnitte). Hier nur Beschreibung und Zahl der Werte; die Werte von `slice` hängen von der Zahl der Abschnitte ab.
 */
const SAMPLER_MODES = { scrub: 1, slice: 2 };

const groupOf = (name) => (PITCH.has(name) ? 'pitch' : MIDI_PREFIX.test(name) ? 'midi' : 'audio');

function firstSentence(text) {
  const flat = text.replace(/\s+/g, ' ').replace(/[`*]/g, '').trim();
  // Satzende, aber nicht nach Abkürzungen wie «i.e.» oder «e.g.»
  const m = flat.match(/^.*?(?<!\b(?:i\.e|e\.g))[.!?](?=\s|$)/);
  return m ? m[0] : flat;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;
const WORD = /^[A-Za-z][\w]*$/;

/**
 * Werte, die Strudels Beispiele diesem Effekt geben (`.lpf("<200 800>")`, `.room(.5)`), als einzelne Wörter.
 * Zahlen aufsteigend und ohne Doppelte (`.5` = `0.5`), danach Namen in ihrer Reihenfolge (`a e i o u`).
 */
function exampleValues(text, names) {
  const numbers = new Map();
  const words = new Set();
  for (const n of names) {
    // `.transpose("<0 -2 5 3>".slow(2))`: `.slow`/`.fast` danach ändern nur die Zeit; `.div(8)` die Werte, das zählt nicht
    const call = new RegExp(`\\.${escape(n)}\\(\\s*(?:"([^"]*)"|'([^']*)'|(-?[\\d.]+))(?:\\.(?:slow|fast)\\([^()]*\\))*\\s*\\)`, 'g');
    for (const m of text.matchAll(call)) {
      // `1000:20` = Wert und Zusatzparameter (hier Resonanz), nur der Wert zählt
      // Zahlen hinter Modifiern (`!2`, `@3`, `*4`, `/2`, `%8`, `?0.3`) sind keine Werte
      const mini = (m[1] ?? m[2] ?? m[3]).replace(/[*!@%/?]-?[\d.]*/g, ' ');
      for (const part of mini.split(/[\s<>[\]{}*!@?,~|%/()]+/)) {
        const atom = part.split(':')[0];
        if (NUMBER.test(atom)) {
          if (!numbers.has(Number(atom))) numbers.set(Number(atom), atom);
        } else if (WORD.test(atom)) words.add(atom);
      }
    }
  }
  const sorted = [...numbers.entries()].sort((a, b) => a[0] - b[0]).map(([, atom]) => atom);
  return [...sorted, ...words];
}

/** Die JSDoc-Kommentare einer Quelldatei: Zeilen ohne `*` und eine Abfrage für Tags (`tag('name')`). */
function* docComments(source) {
  for (const [, body] of source.matchAll(/\/\*\*([\s\S]*?)\*\//g)) {
    const lines = body.split('\n').map((l) => l.replace(/^\s*\*\s?/, ''));
    const tag = (name) => lines.filter((l) => l.startsWith(`@${name}`)).map((l) => l.slice(name.length + 1).trim());
    yield { lines, tag };
  }
}

/** Ein Eintrag aus einem JSDoc-Kommentar: erster Satz, Wertangabe, Synonyme, Werte aus den Beispielen. */
function describe(name, group, { lines, tag }) {
  const params = tag('param');
  const firstTag = lines.findIndex((l) => l.startsWith('@'));
  const description = firstSentence(lines.slice(0, firstTag < 0 ? undefined : firstTag).join(' '));
  // `{number | Pattern} attack time in seconds.` → `time in seconds`
  const hint = (params[0] ?? '').replace(/^\{[^}]*\}\s*/, '').replace(/^\[?[\w.]+\]?\s*/, '').replace(/\.$/, '').trim();
  const synonyms = (tag('synonyms')[0] ?? '').split(/[,\s]+/).filter(Boolean);
  const examples = lines.filter((l) => !l.startsWith('@')).join('\n');
  return { name, group, synonyms, description, hint, values: exampleValues(examples, [name, ...synonyms]) };
}

export function extractEffects(source = readFileSync(CONTROLS, 'utf8'), patternSource = readFileSync(PATTERN, 'utf8')) {
  const effects = new Map();
  for (const doc of docComments(source)) {
    const [name] = doc.tag('name');
    if (!name || effects.has(name)) continue;
    if (doc.tag('superdirtOnly').length > 0) continue;
    if (NOT_EFFECTS.has(name) || NOT_EFFECT_PREFIX.test(name)) continue;
    // Effekte mit Objekt als Wert (env, lfo, bmod …) lassen sich nicht als einzelner Wert setzen
    if (doc.tag('param').some((p) => /^\{Object\}/.test(p))) continue;
    effects.set(name, describe(name, groupOf(name), doc));
  }
  for (const op of extractSampleOps(source, patternSource)) effects.set(op.name, op);
  const taken = new Set([...effects.values()].flatMap((e) => [e.name, ...e.synonyms]));
  for (const n of [...extractNoteOps(patternSource).map((o) => o.name), ...Object.keys(SAMPLER_MODES)]) taken.add(n);
  for (const op of extractPatternOps(taken)) effects.set(op.name, op);
  return [...effects.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Zahl der Werte einer mit `register` gebauten Funktion: ihre Parameter ohne das Muster am Schluss.
 * `register('chop', function (n, pat)` → 1, `register('fit', (pat) =>` → 0. null, wenn der Aufruf fehlt.
 */
function arity(name, source) {
  const m = new RegExp(`register\\(\\s*(?:'${name}'|\\[\\s*'${name}'[^\\]]*\\])\\s*,\\s*(?:function\\s*)?\\(([^)]*)\\)`).exec(source);
  return m ? m[1].split(',').filter((p) => p.trim()).length - 1 : null;
}

/** Die Sample-Funktionen aus `SAMPLE_OPS`, gesucht in controls.mjs (`scrub`) und pattern.mjs. Fehlt eine, bricht das Skript ab. */
export function extractSampleOps(controls = readFileSync(CONTROLS, 'utf8'), pattern = readFileSync(PATTERN, 'utf8')) {
  return SAMPLE_OPS.map((name) => {
    for (const source of [controls, pattern]) {
      const n = arity(name, source);
      const doc = [...docComments(source)].find((d) => d.tag('name')[0] === name);
      if (n === null || !doc) continue;
      if (n > 1) throw new Error(`${name} nimmt ${n} Werte, eine Box hat nur eine Wertreihe`);
      const info = describe(name, 'sample', doc);
      return n === 0 ? { ...info, noValue: true } : info;
    }
    throw new Error(`${name} fehlt in Strudel`);
  });
}

/** Beschreibungen der Sampler-Arten (`SAMPLER_MODES`). Nimmt eine andere Werte als erwartet, bricht das Skript ab. */
export function extractSamplerModes(controls = readFileSync(CONTROLS, 'utf8'), pattern = readFileSync(PATTERN, 'utf8')) {
  return Object.entries(SAMPLER_MODES).map(([name, expected]) => {
    for (const source of [controls, pattern]) {
      const n = arity(name, source);
      const doc = [...docComments(source)].find((d) => d.tag('name')[0] === name);
      if (n === null || !doc) continue;
      if (n !== expected) throw new Error(`${name} nimmt ${n} Werte statt ${expected}`);
      return describe(name, 'sample', doc);
    }
    throw new Error(`${name} fehlt in Strudel`);
  });
}

/**
 * Woher die Musterbefehle kommen und in welche Gruppe sie gehören: `pattern` ordnet Ereignisse in der Zeit um (`fast`, `rev`,
 * `struct`), `random` mit Zufall (`degradeBy`, `shuffle`), `tonal` verändert Tonhöhen (`transpose`, `scale`).
 * Welche Spur welche Gruppe anbietet, entscheidet `offersEffect` in `effects.ts`.
 */
const PATTERN_SOURCES = [
  [PATTERN, 'pattern'],
  [EUCLID, 'pattern'],
  [SIGNAL, 'random'],
  [TONAL, 'tonal'],
];

/**
 * Befehle, die eine Struktur aus Treffern und Pausen nehmen (`struct("x ~ x")`). Ihr Wert ist immer Mini-Notation
 * (`miniOnly`), neue Boxen beginnen mit `x` (ein Treffer, an der Spur ändert sich nichts). Strudel baut sie nicht mit
 * `register`, sondern als `Pattern.prototype.struct = function (...args)`.
 */
const STRUCTURE_OPS = ['struct', 'mask', 'reset', 'restart'];

/**
 * Musterbefehle mit höchstens einem Wert, die trotzdem nicht in eine Box gehören. Ein Filter wie `NOT_EFFECTS`:
 * Neue Befehle in Strudel kommen ohne Zutun dazu.
 * `round` … `ratio` rechnen mit Zahlen in der Mini-Notation (wie `add`), eine Spur aus Klängen oder Noten hat keine.
 * `keyDown` fragt die Tastatur ab, `segment` tastet stetige Signale ab und `pace` setzt Schritte für `stepcat`.
 */
const NOT_PATTERN_OPS = new Set(['round', 'floor', 'ceil', 'toBipolar', 'fromBipolar', 'ratio', 'keyDown', 'segment', 'pace']);

/** Parameter, die eine Funktion oder ein Objekt nehmen (`jux(rev)`, `pick({…})`): nicht als Wertreihe darstellbar. */
const FUNCTION_PARAM = /^(func|funcs|f|fn|test|lookup|_)$/;

/**
 * Grundtöne für die Auswahl bei `scale`. Strudel nimmt jeden Notennamen, auch mit Oktave (`Bb4:dorian`), die Auswahl
 * bietet die zwölf üblichen Schreibweisen an. Anderes geht über die Wertsteine.
 */
const SCALE_ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Die Definitionen in einer Quelldatei: `register('fast', function (factor, pat)`, `register(['fast', 'density'], (factor, pat) =>`
 * und die Strukturbefehle (`Pattern.prototype.struct = function (...args)`). `params` ohne das Muster am Schluss.
 */
function* definitions(source) {
  const register = /register\(\s*(\[[^\]]*\]|'[^']+')\s*,\s*(?:function\s*\w*\s*)?\(([^)]*)\)/g;
  for (const m of source.matchAll(register)) {
    const names = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    // `offset /* : number | string */` → `offset`
    const params = m[2].replace(/\/\*.*?\*\//g, '').split(',').map((p) => p.trim()).filter(Boolean);
    yield { names, params: params.slice(0, -1), at: m.index };
  }
  for (const m of source.matchAll(/Pattern\.prototype\.(\w+) = function \(\.\.\.args\)/g)) {
    if (STRUCTURE_OPS.includes(m[1])) yield { names: [m[1]], params: ['structure'], at: m.index };
  }
}

/**
 * Der JSDoc-Kommentar direkt vor einer Definition (dazwischen höchstens `export const x =`), sonst einer mit passendem `@name`.
 * Ohne Kommentar fehlt die Beschreibung: solche Befehle lässt das Skript weg.
 */
function docOf(source, at, names, docs) {
  const before = source.slice(0, at);
  const end = before.lastIndexOf('*/');
  const start = before.lastIndexOf('/**', end);
  if (end >= 0 && start >= 0 && /^\s*((export\s+)?(const|let)\s+[^;=]*=\s*)?$/.test(before.slice(end + 2))) {
    const [doc] = docComments(source.slice(start, end + 2));
    if (doc) return doc;
  }
  return names.map((n) => docs.get(n)).find(Boolean) ?? null;
}

/**
 * Musterbefehle mit höchstens einem Wert, der keine Funktion ist: `fast(2)`, `rev()`, `struct("x ~ x")`, `degradeBy(.5)`,
 * `transpose(7)`, `scale("C:minor")`. Im Code nach dem Muster wie Effekte. Befehle mit mehreren Werten (`euclid(3, 8)`)
 * oder mit einer Funktion (`jux(rev)`, `every(4, fast(2))`) lassen sich nicht als eine Wertreihe darstellen und fehlen.
 * `taken`: Namen, die schon Effekte, Sample-Funktionen oder Rechenarten sind.
 */
export function extractPatternOps(taken, sources = PATTERN_SOURCES.map(([file, group]) => [readFileSync(file, 'utf8'), group]), scaleTypes = extractScaleTypes()) {
  const ops = new Map();
  for (const [source, group] of sources) {
    const docs = new Map();
    for (const doc of docComments(source)) {
      for (const n of [...doc.tag('name'), ...(doc.tag('synonyms')[0] ?? '').split(/[,\s]+/)]) if (n && !docs.has(n)) docs.set(n, doc);
    }
    for (const { names, params, at } of definitions(source)) {
      // `density` ist auch ein Steuerparameter: dann fehlt nur das Synonym, `fast` bleibt
      if (taken.has(names[0]) || ops.has(names[0]) || NOT_PATTERN_OPS.has(names[0])) continue;
      if (params.length > 1 || params.some((p) => FUNCTION_PARAM.test(p))) continue;
      const doc = docOf(source, at, names, docs);
      if (!doc || doc.tag('param').some((p) => /^\{[^}]*(function|object)/i.test(p))) continue;
      const [docName] = doc.tag('name');
      const name = names.includes(docName) ? docName : names[0];
      const info = describe(name, group, doc);
      info.synonyms = [...new Set([...info.synonyms, ...names])].filter((n) => n !== name && !taken.has(n));
      if (params.length === 0) info.noValue = true;
      if (STRUCTURE_OPS.includes(name)) Object.assign(info, { miniOnly: true, start: 'x' });
      // Pfeiltasten schalten den Grundton weiter, die Tonleiter nach dem Doppelpunkt bleibt (`stepValue`)
      if (name === 'scale') Object.assign(info, { values: SCALE_ROOTS, start: 'C:major', parts: [SCALE_ROOTS, scaleTypes] });
      ops.set(name, info);
    }
  }
  return [...ops.values()];
}

/**
 * Die Tonleitern, die `scale` kennt: Tonal.js, wie es `@strudel/tonal` mitbringt (`@tonaljs/scale-type`, Liste `SCALES`),
 * je der erste Name, Leerzeichen als Doppelpunkt (`major:pentatonic`), wie Strudel sie in der Mini-Notation verlangt.
 * Namen mit Apostroph (`messiaen's mode #3`) kann die Mini-Notation nicht lesen. Alphabetisch.
 */
export function extractScaleTypes() {
  const tonal = createRequire(realpathSync(TONAL_PACKAGE)).resolve('@tonaljs/tonal/package.json');
  const scaleType = createRequire(tonal).resolve('@tonaljs/scale-type/package.json');
  const source = readFileSync(join(dirname(scaleType), 'dist', 'index.mjs'), 'utf8');
  const m = /const SCALES = (\[[\s\S]*?\n\]);/.exec(source);
  if (!m) throw new Error('Liste SCALES in @tonaljs/scale-type nicht gefunden');
  const scales = JSON.parse(m[1].replace(/,(\s*\])/g, '$1'));
  return scales
    .map(([, name]) => name.replaceAll(' ', ':'))
    .filter((name) => !name.includes("'"))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Rechenarten für Noten: die Verknüpfungen, die Strudel mit `numeralArgs` baut (Notennamen werden dabei zu MIDI-Zahlen),
 * soweit sie dokumentiert sind (`add`, `sub`, `mul`, `div`). Reihenfolge wie im Quelltext.
 * Im Code stehen sie an der Mini-Notation: `note("c e".add("<0 3>"))`.
 */
export function extractNoteOps(source = readFileSync(PATTERN, 'utf8')) {
  const numeral = [...source.matchAll(/^\s*(\w+): \[numeralArgs\(/gm)].map((m) => m[1]);
  const docs = new Map();
  for (const doc of docComments(source)) {
    const [name] = doc.tag('name');
    if (name && numeral.includes(name) && !docs.has(name)) docs.set(name, describe(name, 'arith', doc));
  }
  return numeral.filter((n) => docs.has(n)).map((n) => docs.get(n));
}

export function renderModule(effects, noteOps, samplerModes) {
  return `// Erzeugt von scripts/strudel-effects.mjs aus @strudel/core, @strudel/tonal und Tonal.js. Nicht von Hand ändern: npm run gen:effects
import type { EffectInfo } from './effects.ts';

export const EFFECTS: readonly EffectInfo[] = ${JSON.stringify(effects, null, 2)};

export const NOTE_OPS: readonly EffectInfo[] = ${JSON.stringify(noteOps, null, 2)};

export const SAMPLER_MODES: readonly EffectInfo[] = ${JSON.stringify(samplerModes, null, 2)};
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const effects = extractEffects();
  const noteOps = extractNoteOps();
  writeFileSync(OUTPUT, renderModule(effects, noteOps, extractSamplerModes()));
  console.log(`${effects.length} Effekte und Befehle, ${noteOps.length} Rechenarten für Noten nach ${OUTPUT}`);
}
