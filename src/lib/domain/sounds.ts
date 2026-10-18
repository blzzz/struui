import { SOUND_SOURCES } from './sounds.generated.ts';

/**
 * Klänge, die Strudel kennt. Die Namen werden nicht von Hand gepflegt: `npm run gen:sounds` holt sie aus denselben Quellen,
 * die Strudel beim Start lädt (Prebake von `@strudel/repl`, superdough). Eine frühere Liste aus dem Gedächtnis enthielt
 * 64 Namen, die Strudel nicht kennt (`juno`, `808`, `bass` …), und lieferte «sound … not found».
 */
export interface SoundSource {
  /** `uzu-drumkit`, `Dirt-Samples`, `vcsl` … oder `synth`, `noise`, `zzfx` (ohne Adresse, aus superdough). */
  id: string;
  /** Adresse der Sample-Liste, null bei Klängen aus superdough. */
  url: string | null;
  names: string[];
}

export { SOUND_SOURCES };

const source = (id: string): readonly string[] => SOUND_SOURCES.find((s) => s.id === id)?.names ?? [];

/** Klänge, durch die das Einzeltippen schaltet (derzeit ungenutzt, siehe `quickSwitch`). */
export const QUICK_SOUNDS = ['bd', 'sd', 'hh', 'oh', 'cp', '~'] as const;

/** Alle Namen aus allen Quellen, z. B. um unbekannte Klänge zu erkennen. */
export const ALL_SOUNDS: ReadonlySet<string> = new Set(SOUND_SOURCES.flatMap((s) => s.names));

/**
 * Was die Palette zeigt, in dieser Reihenfolge. Welche Quellen hier stehen, ist eine Auswahl (die Namen darin nicht):
 * Die 683 Drum-Machine-Klänge (`AkaiLinn_bd` …) fehlen, sie gehören eher zu einer Wahl der Drum Machine (`.bank()`).
 */
export const SOUND_GROUPS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['Pause', ['~']],
  ['Schlagzeug', source('uzu-drumkit')],
  ['Synth', source('synth')],
  ['Rauschen', source('noise')],
  ['Klänge', [...source('Dirt-Samples'), ...source('piano')]],
  ['Mridangam', source('mridangam')],
  ['Instrumente', source('vcsl')],
  ['ZZFX', source('zzfx')],
];

/**
 * Was man in einen Klangstein tippen darf: ein Name wie Strudels Klänge (`bd`, `gm_piano`, `rec1`), wahlweise mit der Nummer
 * der Variante nach einem Doppelpunkt (`bd:3`, in Strudel dasselbe wie `.n(3)`). Auch unbekannte Namen (eigene Aufnahmen,
 * später geladene Samples), aber keine Pause und keine weitere Mini-Notation (`bd*2` wäre ein roher Stein).
 */
export function isSoundName(text: string): boolean {
  return /^[A-Za-z]\w*(:\d+)?$/.test(text);
}

/** Klangname und Variante (`bd:3` → `bd`, 3). Ohne Doppelpunkt ist die Variante 0, wie in Strudel. */
export function splitVariant(sound: string): { name: string; variant: number } {
  const m = /^(.*):(\d+)$/.exec(sound);
  return m ? { name: m[1], variant: Number(m[2]) } : { name: sound, variant: 0 };
}

/**
 * Nächste (`dir` 1) oder vorherige (-1) Variante eines Klangs, für −/+ beim Bearbeiten: `bd` → `bd:1` → `bd:2`, zurück bis `bd`.
 * Wie viele Varianten es gibt, wissen wir nicht; Strudel zählt über das Ende hinaus wieder von vorn. Pausen bleiben unverändert.
 */
export function stepVariant(current: string, dir: 1 | -1): string {
  if (!isSoundName(current)) return current;
  const { name, variant } = splitVariant(current);
  const next = Math.max(0, variant + dir);
  return next === 0 ? name : `${name}:${next}`;
}
