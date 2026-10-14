import type { Token, TrackType } from './types.ts';
import { EFFECTS, NOTE_OPS } from './effects.generated.ts';

/**
 * Effekte hängen an einer ganzen Spur, im Code als Methoden nach dem Muster: `s("bd sd").lpf(800).room("<0 .5>")`.
 * Der Wert eines Effekts ist eine Steinliste wie eine Spur, nur liegen Werte statt Klängen darauf.
 * Welche Effekte es gibt, stammt aus Strudels eigener Dokumentation (`effects.generated.ts`), nicht von Hand.
 */
export interface EffectInfo {
  name: string;
  /**
   * `audio` wirkt auf den Klang, `pitch` setzt die Tonhöhe, `midi` geht nur an MIDI-Geräte (`ccv`, `progNum` …).
   * `arith` rechnet mit den Noten einer Notenspur (`add`, `div` …, siehe `NOTE_OPS`), kein Effekt.
   */
  group: 'audio' | 'pitch' | 'midi' | 'arith';
  /** Andere Namen, unter denen Strudel denselben Effekt kennt (`lpf` = `cutoff`). */
  synonyms: string[];
  /** Erster Satz aus Strudels Dokumentation (englisch). */
  description: string;
  /** Was der Wert bedeutet, z. B. `time in seconds`. Kann leer sein. */
  hint: string;
  /** Werte aus Strudels Beispielen, Zahlen aufsteigend. Durch sie schaltet das Einzeltippen. Kann leer sein. */
  values: string[];
}

export interface Effect {
  id: string;
  name: string;
  /** Der Wert als Steine. `sound` eines Steins ist hier ein Wert (`800`, `.5`, `a`). Leer = aus, nicht im Code. */
  tokens: Token[];
}

export { EFFECTS, NOTE_OPS };

function index(list: readonly EffectInfo[]): Map<string, EffectInfo> {
  const byName = new Map<string, EffectInfo>();
  for (const e of list) for (const n of [e.name, ...e.synonyms]) if (!byName.has(n)) byName.set(n, e);
  return byName;
}
const effectsByName = index(EFFECTS);
const opsByName = index(NOTE_OPS);

/** Auch Synonyme werden gefunden (`cutoff` → `lpf`). */
export function effectInfo(name: string): EffectInfo | undefined {
  return effectsByName.get(name);
}

/**
 * Rechenart für die Noten einer Notenspur (`add`, `sub`, `mul`, `div`). Im Code an der Mini-Notation:
 * `note("c e".add("<0 3>"))`. Strudel rechnet dabei mit MIDI-Zahlen (`c3` = 48). Als Methode nach `note(…)`
 * wirkte `add` nicht auf die Noten, deshalb stehen sie dort.
 */
export function noteOpInfo(name: string): EffectInfo | undefined {
  return opsByName.get(name);
}

/** Beschreibung zu einer Wertreihe, egal ob Effekt oder Rechenart. */
export function valueInfo(name: string): EffectInfo | undefined {
  return effectInfo(name) ?? noteOpInfo(name);
}

/** Startwert eines neuen Effekts: der mittlere Beispielwert, oder null, wenn Strudel keinen zeigt. */
export function defaultValue(info: EffectInfo): string | null {
  return info.values.length === 0 ? null : info.values[Math.floor((info.values.length - 1) / 2)];
}

/** Ein Wert ist ein einzelnes Wort der Mini-Notation: eine Zahl (`800`, `-1`, `.5`) oder ein Name (`a`, `sine`). */
export function isValueAtom(text: string): boolean {
  return /^(-?(\d+\.?\d*|\.\d+)|[A-Za-z][\w.#]*)$/.test(text);
}

/** Audio-Effekte, die `@strudel/midi` auch für MIDI liest: Strudel schickt `gain × velocity` als Anschlagstärke. */
const MIDI_AUDIO = new Set(['velocity', 'gain']);

/**
 * Was eine Spur anbietet: Klangspuren Audio und Tonhöhe, Notenspuren nur Audio (die Tonhöhe tragen die Steine),
 * MIDI-Spuren MIDI, Tonhöhe und die Anschlagstärke.
 */
export function offersEffect(type: TrackType, e: EffectInfo): boolean {
  if (type === 'sound') return e.group !== 'midi';
  if (type === 'note') return e.group === 'audio';
  return e.group !== 'audio' || MIDI_AUDIO.has(e.name);
}

/**
 * Effekte für die Autovervollständigung, nur die zur Art der Spur passenden. Zuerst Namen, die mit der Eingabe beginnen, dann Synonyme,
 * dann Treffer irgendwo im Namen oder in der Beschreibung.
 */
export function searchEffects(query: string, type: TrackType = 'sound', limit = 12): EffectInfo[] {
  return search(
    EFFECTS.filter((e) => offersEffect(type, e)),
    query,
    limit,
  );
}

/** Rechenarten für Noten, gesucht wie Effekte. */
export function searchNoteOps(query: string, limit = 12): EffectInfo[] {
  return search(NOTE_OPS, query, limit);
}

function search(offered: readonly EffectInfo[], query: string, limit: number): EffectInfo[] {
  const q = query.trim().toLowerCase();
  if (q === '') return offered.slice(0, limit);
  const rank = (e: EffectInfo): number => {
    const name = e.name.toLowerCase();
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (e.synonyms.some((s) => s.toLowerCase().startsWith(q))) return 2;
    if (name.includes(q)) return 3;
    if (e.description.toLowerCase().includes(q)) return 4;
    return -1;
  };
  return offered.map((e) => ({ e, r: rank(e) }))
    .filter(({ r }) => r >= 0)
    .sort((a, b) => a.r - b.r || a.e.name.length - b.e.name.length || a.e.name.localeCompare(b.e.name))
    .slice(0, limit)
    .map(({ e }) => e);
}

/**
 * Nächster Wert nach oben (`dir` 1) oder unten (-1), für die Pfeiltasten beim Bearbeiten eines Wertsteins.
 * Zahlen springen zum nächstgrösseren bzw. -kleineren Beispielwert (am Rand bleibt es dort), Namen schalten im Kreis.
 * Ohne passende Beispielwerte zählen Zahlen in Einer- oder Zehntelschritten.
 */
export function stepValue(current: string, values: readonly string[], dir: 1 | -1): string {
  const n = Number(current);
  const numbers = values.filter((v) => /^-?(\d+\.?\d*|\.\d+)$/.test(v));
  if (current.trim() !== '' && !Number.isNaN(n)) {
    if (numbers.length > 0) {
      const next = dir === 1 ? numbers.find((v) => Number(v) > n) : [...numbers].reverse().find((v) => Number(v) < n);
      return next ?? current;
    }
    const step = Number.isInteger(n) ? 1 : 0.1;
    return String(Math.round((n + dir * step) * 1000) / 1000);
  }
  const words = values.filter((v) => !numbers.includes(v));
  if (words.length === 0) return values[0] ?? current;
  const i = words.indexOf(current);
  return words[(i + dir + words.length) % words.length] ?? words[0];
}
