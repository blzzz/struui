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
  } from '../domain/scales.ts';
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

  const placeholders = { random: '?', repeat: '*!@', steps: '%' };

  /** Tippen: Zufall und Modulo an/aus. Wiederholung: aus, Stern, Ausrufezeichen, Gewicht, aus. */
  function tap() {
    if (kind === 'random') {
      token.random = token.random === null ? DEFAULT_RANDOM : null;
    } else if (kind === 'steps') {
      const close = token as CloseToken;
      close.steps = close.steps === null ? DEFAULT_STEPS : null;
    } else {
      const r = token.repeat;
      token.repeat =
        r === null
          ? { op: '*', value: DEFAULT_STAR }
          : r.op === '*'
            ? { op: '!', value: DEFAULT_BANG }
            : r.op === '!'
              ? { op: '@', value: DEFAULT_WEIGHT }
              : null;
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
/>
