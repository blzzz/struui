import { SvelteMap } from 'svelte/reactivity';
import { RecordError } from '../audio/recorder.ts';
import { encodeWav, toDataUrl, toMonoResampled, trimAndNormalize } from '../audio/wav.ts';

/**
 * Dekodieren: zuerst ohne Nutzeraktion über OfflineAudioContext. Manche Safari-Versionen lesen damit
 * aufgenommenes mp4 nicht, dann über einen kurzlebigen AudioContext.
 */
async function decode(raw: ArrayBuffer): Promise<AudioBuffer> {
  try {
    return await new OfflineAudioContext(1, 1, 44100).decodeAudioData(raw.slice(0));
  } catch {
    const ctx = new AudioContext();
    try {
      return await ctx.decodeAudioData(raw.slice(0));
    } catch {
      throw new RecordError('Der Klang konnte nicht gelesen werden (Format unbekannt).');
    } finally {
      void ctx.close();
    }
  }
}

/** Eigene Aufnahmen und geladene Dateien. Nur im Speicher, beim Neuladen sind sie weg. */
class SampleBank {
  /** Name zu WAV-Data-URL (mono, 16 kHz). Reaktiv, weil der Code davon abhängt. */
  readonly dataUrls = new SvelteMap<string, string>();
  private counter = 0;

  get names(): string[] {
    return [...this.dataUrls.keys()];
  }

  /** Dekodiert, kürzt, normalisiert und legt den Klang ab. Gibt den vergebenen Namen zurück. */
  async add(blob: Blob, prefix: 'rec' | 'smp'): Promise<string> {
    const decoded = await decode(await blob.arrayBuffer());
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i));
    let trimmed: Float32Array[];
    try {
      trimmed = trimAndNormalize(channels, decoded.sampleRate);
    } catch {
      throw new RecordError('Die Aufnahme ist still. Ist das richtige Mikrofon gewählt?');
    }
    const mono = toMonoResampled(trimmed, decoded.sampleRate, 16000);
    const name = `${prefix}${++this.counter}`;
    this.dataUrls.set(name, toDataUrl(encodeWav(mono, 16000)));
    return name;
  }
}

export const sampleBank = new SampleBank();
