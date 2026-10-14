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

/** Umkehrung: Winkel (Grad, 0 = oben, im Uhrzeigersinn) zum nächsten Rastwert-Index. */
export function indexForAngle(angle: number, count: number): number {
  const clamped = Math.max(-135, Math.min(135, angle));
  return Math.round(((clamped + 135) / 270) * (count - 1));
}
