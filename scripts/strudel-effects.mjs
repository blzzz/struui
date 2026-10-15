// Liest die Effekte aus den JSDoc-Kommentaren von `@strudel/core/controls.mjs`, statt sie abzuschreiben,
// dazu die Sample-Funktionen (`chop`, `fit` …) und die Rechenarten für Noten (`add`, `div` …) aus `@strudel/core/pattern.mjs`.
// Aufruf: npm run gen:effects (schreibt src/lib/domain/effects.generated.ts).
// Der Test `effects.test.ts` prüft, dass die Datei zum installierten Strudel passt.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const CONTROLS = fileURLToPath(new URL('../node_modules/@strudel/core/controls.mjs', import.meta.url));
export const PATTERN = fileURLToPath(new URL('../node_modules/@strudel/core/pattern.mjs', import.meta.url));
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
    const call = new RegExp(`\\.${escape(n)}\\(\\s*(?:"([^"]*)"|'([^']*)'|(-?[\\d.]+))\\s*\\)`, 'g');
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
  return `// Erzeugt von scripts/strudel-effects.mjs aus @strudel/core/controls.mjs und pattern.mjs. Nicht von Hand ändern: npm run gen:effects
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
  console.log(`${effects.length} Effekte und ${noteOps.length} Rechenarten für Noten nach ${OUTPUT}`);
}
