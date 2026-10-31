import type { EffectCategory } from '../domain/effects.ts';
import type { ParseErrorCode } from '../domain/parse.ts';

/** Filter der Effektsuche (`EffectPicker`). */
export const CATEGORY_LABELS: Record<EffectCategory, string> = {
  filter: 'Filter',
  envelope: 'Hüllkurve',
  space: 'Raum',
  distortion: 'Verzerrung',
  motion: 'Modulation',
  synth: 'Synth',
  pitch: 'Tonhöhe',
  level: 'Pegel',
  sample: 'Sample',
  pattern: 'Muster',
  random: 'Zufall',
  tonal: 'Tonart',
  midi: 'MIDI',
  arith: 'Rechnen',
  other: 'Weitere',
};

/** Alle Texte, die aus der Domäne in die Oberfläche kommen. Offene Frage: i18n ja/nein. */
export const PARSE_MESSAGES: Record<ParseErrorCode, string> = {
  'unmatched-close': 'Schliessende Klammer ohne öffnende davor.',
  'mismatched-close': 'Diese schliessende Klammer passt nicht zur offenen.',
  'unclosed-open': 'Eine Klammer ist nicht geschlossen.',
  'empty-group': 'Leere Klammer: Strudel braucht mindestens einen Stein darin.',
  'strudel-syntax': 'Strudel versteht diese Stelle nicht.',
};
