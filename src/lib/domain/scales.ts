/** Rastwerte der Drehknöpfe. Die Mitte von STAR (1) bedeutet "keine Änderung". */
export const STAR_VALUES = [0.125, 0.25, 0.5, 1, 2, 4, 8] as const;
export const BANG_VALUES = [2, 3, 4, 6, 8] as const;
export const RANDOM_VALUES = [0.1, 0.25, 0.5, 0.75, 0.9] as const;
/** Gewicht `@`: unter 1 wird der Schritt kürzer, darüber länger. */
export const WEIGHT_VALUES = [0.5, 1.5, 2, 3, 4, 6, 8] as const;
/** Modulo `%` an `}`: Schritte pro Zyklus. */
export const STEPS_VALUES = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export const DEFAULT_STAR = 2;
export const DEFAULT_BANG = 2;
export const DEFAULT_RANDOM = 0.5;
export const DEFAULT_WEIGHT = 2;
export const DEFAULT_STEPS = 4;

/** Wofür ein eingetippter Operatorwert gilt: Zufall `?`, Wiederholung `*` `!` `@` oder Modulo `%`. */
export type ModOp = '?' | '*' | '!' | '@' | '%';

/**
 * Eingetippter Wert eines Operators, oder null wenn ungültig. Erlaubt sind Dezimalzahlen (`3`, `1.5`, `.25`, Komma geht auch),
 * bei `?` zwischen 0 und 1 (ausschliesslich), bei `!` ganze Zahlen ab 1, sonst grösser als 0.
 * Höchstens drei Nachkommastellen und kleiner als 1000, damit die Zahl im Code ohne Exponent steht (`String(v)`).
 */
export function parseModValue(op: ModOp, text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^(\d+\.?\d{0,3}|\.\d{1,3})$/.test(t)) return null;
  const v = Number(t);
  if (!(v > 0) || v >= 1000) return null;
  if (op === '?' && v >= 1) return null;
  if (op === '!' && !Number.isInteger(v)) return null;
  return v;
}

export function nearestIndex(values: readonly number[], value: number): number {
  let best = 0;
  for (let i = 1; i < values.length; i += 1) {
    if (Math.abs(values[i] - value) < Math.abs(values[best] - value)) best = i;
  }
  return best;
}

/** Drehwinkel (Grad, -135 bis +135) für einen Rastwert. */
export function angleFor(index: number, count: number): number {
  return -135 + (index * 270) / (count - 1);
}

/** Drehwinkel (Grad, -135 bis +135) für eine stufenlose Stellung 0 … 1. */
export function angleForPosition(position: number): number {
  return -135 + Math.max(0, Math.min(1, position)) * 270;
}

/**
 * Umkehrung für stufenlose Knöpfe: Winkel (Grad, 0 = oben, im Uhrzeigersinn) zur Stellung 0 … 1.
 * Im toten Bereich unten (über ±135°) bleibt der Knopf am Ende, an dem er war (`last`), statt von 1 auf 0 zu springen.
 */
export function positionForAngle(angle: number, last: number): number {
  if (Math.abs(angle) > 135) return last >= 0.5 ? 1 : 0;
  return (angle + 135) / 270;
}

/** Umkehrung: Winkel (Grad, 0 = oben, im Uhrzeigersinn) zum nächsten Rastwert-Index. */
export function indexForAngle(angle: number, count: number): number {
  const clamped = Math.max(-135, Math.min(135, angle));
  return Math.round(((clamped + 135) / 270) * (count - 1));
}
