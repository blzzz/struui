import { SAMPLER_MODES } from './effects.generated.ts';
import type { EffectInfo } from './effects.ts';

/**
 * Sampler-Spur: ein Sample (`s("brk")`, eine feste Klangreihe), darauf Wertsteine, die Stellen darin spielen.
 * `scrub`: Positionen von 0 bis 1 (`s("brk").scrub("0 .25 <.5 .75>")`).
 * `slice`: das Sample in gleich lange Abschnitte geteilt, die Steine sind Abschnittsnummern (`s("brk").slice(8, "0 3 7")`).
 */
export type SamplerMode = 'scrub' | 'slice';

/** Sample einer neuen Sampler-Spur: der Breakbeat aus Strudels Drumkit (auch in Strudels Beispiel zu `scrub`). */
export const DEFAULT_SAMPLE = 'brk';
export const DEFAULT_SLICES = 8;
/** Höchstens so viele Abschnitte; die Zahl lässt sich im Spurkopf einstellen. */
export const SLICES_MAX = 64;

/** Startsteine beim ersten Wechsel zur Sampler-Spur: vier Stellen am Anfang des Samples. */
const START: Record<SamplerMode, string[]> = { scrub: ['0', '.25', '.5', '.75'], slice: ['0', '1', '2', '3'] };

export function startValues(mode: SamplerMode): string[] {
  return [...START[mode]];
}

/** Zahl der Abschnitte, als ganze Zahl von 1 bis `SLICES_MAX`. */
export function clampSlices(n: number): number {
  return Number.isFinite(n) ? Math.max(1, Math.min(SLICES_MAX, Math.round(n))) : DEFAULT_SLICES;
}

/**
 * Beschreibung der Wertsteine wie bei einem Effekt (Text aus Strudel, `effects.generated.ts`). Bei `slice` sind die
 * Werte die Abschnittsnummern 0 bis `slices` − 1, durch sie schalten die Pfeiltasten.
 */
export function samplerInfo(mode: SamplerMode, slices: number): EffectInfo {
  const info = SAMPLER_MODES.find((m) => m.name === mode) as EffectInfo;
  if (mode === 'scrub') return info;
  return { ...info, values: Array.from({ length: clampSlices(slices) }, (_, i) => String(i)) };
}
