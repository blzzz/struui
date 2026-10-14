/**
 * Tempo: intern immer Zyklen pro Sekunde (cps, wie Strudels `setcps`). Angezeigt und eingegeben wird in einer Einheit
 * nach Wahl. BPM folgt Strudels Konvention: ein Zyklus hat 4 Schläge (`setcpm(120/4)` = 120 BPM).
 */
export type TempoUnit = 'bpm' | 'cpm' | 'cps';

export const TEMPO_UNITS: readonly TempoUnit[] = ['bpm', 'cpm', 'cps'];

/** Schläge pro Zyklus für BPM. */
const BEATS_PER_CYCLE = 4;

const PER_CPS: Record<TempoUnit, number> = { bpm: 60 * BEATS_PER_CYCLE, cpm: 60, cps: 1 };

/** Sinnvolle Schrittweite des Zahlenfelds. */
export const TEMPO_STEP: Record<TempoUnit, number> = { bpm: 1, cpm: 0.5, cps: 0.01 };

/** Rundet Gleitkomma-Reste weg (125/240*240 = 125.00000000000001). */
function tidy(x: number): number {
  return Number(x.toFixed(4));
}

export function cpsToUnit(cps: number, unit: TempoUnit): number {
  return tidy(cps * PER_CPS[unit]);
}

export function unitToCps(value: number, unit: TempoUnit): number {
  return value / PER_CPS[unit];
}

/** Zeile für den Code, in der gewählten Einheit, damit der Wert lesbar bleibt. */
export function tempoCode(cps: number, unit: TempoUnit): string {
  const value = cpsToUnit(cps, unit);
  if (unit === 'bpm') return `setcpm(${value}/${BEATS_PER_CYCLE})`;
  if (unit === 'cpm') return `setcpm(${value})`;
  return `setcps(${value})`;
}
