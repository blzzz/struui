<script lang="ts">
  import Knob from './Knob.svelte';
  import {
    BANG_VALUES,
    DEFAULT_BANG,
    DEFAULT_RANDOM,
    DEFAULT_STAR,
    DEFAULT_STEPS,
    DEFAULT_WEIGHT,
    RANDOM_VALUES,
    STAR_VALUES,
    STEPS_VALUES,
    WEIGHT_VALUES,
    parseModValue,
  } from '../domain/scales.ts';
  import type { ModOp } from '../domain/scales.ts';
  import { repeatOps } from '../domain/types.ts';
  import type { CloseToken, Repeat, SoundToken } from '../domain/types.ts';

  /** `random` oben, `repeat` unten. `steps` ist der Modulowert unter `}` (statt Zufall und Wiederholung). */
  let { kind, token }: { kind: 'random' | 'repeat' | 'steps'; token: SoundToken | CloseToken } = $props();

  const REPEAT_VALUES: Record<Repeat['op'], readonly number[]> = { '*': STAR_VALUES, '!': BANG_VALUES, '@': WEIGHT_VALUES };
  const REPEAT_TONES: Record<Repeat['op'], string> = { '*': 'blue', '!': 'green', '@': 'orange' };

  const values = $derived<readonly number[]>(
    kind === 'random' ? RANDOM_VALUES : kind === 'steps' ? STEPS_VALUES : REPEAT_VALUES[token.repeat?.op ?? '*'],
  );
  const current = $derived(
    kind === 'random' ? token.random : kind === 'steps' ? ((token as CloseToken).steps ?? null) : (token.repeat?.value ?? null),
  );
  /** Mitte des Knopfs: nur der Operator. */
  const symbol = $derived(kind === 'random' ? '?' : kind === 'steps' ? '%' : (token.repeat?.op ?? ''));
  const tone = $derived(kind === 'random' ? 'red' : kind === 'steps' ? 'br3' : REPEAT_TONES[token.repeat?.op ?? '*']);
  const labels = { random: 'Zufall', repeat: 'Wiederholung', steps: 'Schritte pro Zyklus' };

  const FRACTIONS: Record<string, string> = { '0.125': '⅛', '0.25': '¼', '0.5': '½', '1.5': '1½' };

  /** Kleine Zahl an der aktuellen Raststufe. Zufall wie im Code (`.25`), sonst Brüche als Zeichen. */
  function format(v: number): string {
    if (kind === 'random') return String(v).replace(/^0\./, '.');
    return FRACTIONS[String(v)] ?? String(v);
  }

  /** Wiederholungen, die der Stein tragen kann: Pausen nur das Gewicht. */
  const ops = $derived(repeatOps(token));
  const placeholders = $derived({ random: '?', repeat: ops.join(''), steps: '%' });
  const STARTS: Record<Repeat['op'], number> = { '*': DEFAULT_STAR, '!': DEFAULT_BANG, '@': DEFAULT_WEIGHT };

  /** Operator, für den ein eingetippter Wert gilt. Bei ausgeschalteter Wiederholung der erste, den der Stein trägt. */
  const repeatOp = $derived(token.repeat?.op ?? ops[0] ?? '*');
  const modOp = $derived<ModOp>(kind === 'random' ? '?' : kind === 'steps' ? '%' : repeatOp);

  /**
   * Eingetippter Wert (langes Drücken): beliebige Zahl, solange sie zum Operator passt (`parseModValue`).
   * War der Knopf aus, schaltet ein gültiger Wert ihn damit ein; ungültig oder leer bleibt alles, wie es war.
   */
  function edit(text: string): boolean {
    const value = parseModValue(modOp, text);
    if (value === null) return false;
    if (kind === 'random') token.random = value;
    else if (kind === 'steps') (token as CloseToken).steps = value;
    else token.repeat = { op: repeatOp, value };
    return true;
  }

  /** Tippen: Zufall und Modulo an/aus. Wiederholung: aus, dann die Operatoren des Steins der Reihe nach (`*`, `!`, `@`), aus. */
  function tap() {
    if (kind === 'random') {
      token.random = token.random === null ? DEFAULT_RANDOM : null;
    } else if (kind === 'steps') {
      const close = token as CloseToken;
      close.steps = close.steps === null ? DEFAULT_STEPS : null;
    } else {
      const next = ops[token.repeat ? ops.indexOf(token.repeat.op) + 1 : 0];
      token.repeat = next ? { op: next, value: STARTS[next] } : null;
    }
  }

  function setStage(i: number) {
    const value = values[i];
    if (kind === 'random') token.random = value;
    else if (kind === 'steps') (token as CloseToken).steps = value;
    else if (token.repeat) token.repeat = { op: token.repeat.op, value };
  }
</script>

<Knob
  {values}
  {current}
  {symbol}
  label={labels[kind]}
  {tone}
  placeholder={placeholders[kind]}
  text={format}
  onTap={tap}
  onStage={setStage}
  onEdit={edit}
  valid={(t) => parseModValue(modOp, t) !== null}
/>
