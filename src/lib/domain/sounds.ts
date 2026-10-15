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
 * Was man in einen Klangstein tippen darf: ein Name wie Strudels Klänge (`bd`, `gm_piano`, `rec1`).
 * Auch unbekannte Namen (eigene Aufnahmen, später geladene Samples), aber keine Pause und keine Mini-Notation (`bd:3` wäre ein roher Stein).
 */
export function isSoundName(text: string): boolean {
  return /^[A-Za-z]\w*$/.test(text);
}

/**
 * Nächster (`dir` 1) oder vorheriger (-1) Klang in der Palettengruppe des Klangs, im Kreis, für ↑/↓ beim Bearbeiten.
 * Pausen und Klänge ausserhalb der Palette bleiben unverändert.
 */
export function stepSound(current: string, dir: 1 | -1): string {
  for (const [, names] of SOUND_GROUPS) {
    const i = names.indexOf(current);
    if (i < 0 || current === '~') continue;
    return names[(i + dir + names.length) % names.length];
  }
  return current;
}
