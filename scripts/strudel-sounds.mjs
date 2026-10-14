// Erzeugt die Klangliste aus denselben Quellen, die Strudel beim Start lädt, statt sie von Hand zu pflegen.
// Aufruf: npm run gen:sounds (braucht Netz, schreibt src/lib/domain/sounds.generated.ts).
// - Samples: die Adressen stehen im Prebake von `@strudel/repl` (`samples(`${ds}/Dirt-Samples.json`)` …), die Listen werden geladen.
// - Synths, Rauschen, ZZFX: aus dem Quelltext von superdough (ohne Netz).
// Der Test `sounds.test.ts` prüft ohne Netz, dass Adressen und Synths noch zum installierten Strudel passen.
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
export const PREBAKE = join(root, 'node_modules/@strudel/repl/prebake.mjs');
export const OUTPUT = join(root, 'src/lib/domain/sounds.generated.ts');

/** superdough ist keine direkte Abhängigkeit (pnpm), deshalb über `@strudel/webaudio` auflösen. */
function superdoughDir() {
  const webaudio = realpathSync(join(root, 'node_modules/@strudel/webaudio'));
  const entry = createRequire(join(webaudio, 'package.json')).resolve('superdough');
  return dirname(dirname(entry));
}

/**
 * Was superdough als Klang anmeldet, aber allein nicht klingt: `user` braucht Teiltöne, `one` ist ein konstantes Signal,
 * `bus` ist Routing, `bytebeat` braucht einen Ausdruck. Das ist ein Filter, keine Liste von Klängen.
 */
const NOT_SOUNDS = new Set(['user', 'one', 'bus', 'bytebeat']);

/** Adressen der Sample-Listen aus dem Prebake, in seiner Reihenfolge. */
export function prebakeUrls(source = readFileSync(PREBAKE, 'utf8')) {
  const consts = Object.fromEntries([...source.matchAll(/const (\w+) = '([^']+)'/g)].map((m) => [m[1], m[2]]));
  return [...source.matchAll(/samples\(`\$\{(\w+)\}([^`]*)`\)/g)].map((m) => {
    if (!consts[m[1]]) throw new Error(`Unbekannte Konstante ${m[1]} im Prebake`);
    return consts[m[1]] + m[2];
  });
}

/** Kurzer Name einer Quelle: Dateiname ohne `.json`, bei `strudel.json` der Name des Repos (`uzu-drumkit`). */
export function sourceId(url) {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  const file = parts.at(-1).replace(/\.json$/, '');
  return file === 'strudel' ? parts[1] : file;
}

/** Synths, Rauschen und ZZFX aus dem Quelltext von superdough. */
export function synthSources(dir = superdoughDir()) {
  const synth = readFileSync(join(dir, 'synth.mjs'), 'utf8');
  const helpers = readFileSync(join(dir, 'helpers.mjs'), 'utf8');
  const zzfx = readFileSync(join(dir, 'zzfx.mjs'), 'utf8');
  const list = (text, pattern) => {
    const m = text.match(pattern);
    if (!m) throw new Error(`Nicht gefunden: ${pattern}`);
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  };
  const waveforms = list(synth, /const waveforms = \[([^\]]*)\]/);
  const registered = [...synth.matchAll(/registerSound\(\s*'([^']+)'/g)].map((m) => m[1]);
  const keep = (names) => [...new Set(names)].filter((n) => !NOT_SOUNDS.has(n));
  return [
    { id: 'synth', url: null, names: keep([...waveforms, ...registered]) },
    { id: 'noise', url: null, names: keep(list(helpers, /export const noises = \[([^\]]*)\]/)) },
    { id: 'zzfx', url: null, names: keep(list(zzfx, /registerZZFXSounds\(\) \{\s*\[([^\]]*)\]/)) },
  ];
}

async function sampleSources() {
  const sources = [];
  for (const url of prebakeUrls()) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    const names = Object.keys(await res.json()).filter((k) => k !== '_base');
    sources.push({ id: sourceId(url), url, names });
  }
  return sources;
}

export function renderModule(sources) {
  return `// Erzeugt von scripts/strudel-sounds.mjs aus dem Prebake von @strudel/repl und superdough. Nicht von Hand ändern: npm run gen:sounds
import type { SoundSource } from './sounds.ts';

export const SOUND_SOURCES: readonly SoundSource[] = ${JSON.stringify(sources, null, 2)};
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sources = [...(await sampleSources()), ...synthSources()];
  writeFileSync(OUTPUT, renderModule(sources));
  for (const s of sources) console.log(`${s.id}: ${s.names.length}`);
}
