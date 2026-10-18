import { SvelteMap } from 'svelte/reactivity';
import { RecordError } from '../audio/recorder.ts';
import { encodeWav, toDataUrl, toMonoResampled, trimAndNormalize } from '../audio/wav.ts';

function peakOf(buffer: AudioBuffer): number {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    for (const v of buffer.getChannelData(c)) peak = Math.max(peak, Math.abs(v));
  }
  return peak;
}

/**
 * Dekodieren: zuerst ohne Nutzeraktion über OfflineAudioContext. Manche Safari-Versionen lesen damit
 * aufgenommenes mp4 nicht (Fehler oder, auf iOS, stillschweigend nur Nullen), dann über einen kurzlebigen AudioContext.
 */
async function decode(raw: ArrayBuffer): Promise<AudioBuffer> {
  let offline: AudioBuffer | null = null;
  try {
    offline = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(raw.slice(0));
    if (peakOf(offline) >= 0.001) return offline;
  } catch {
    // weiter mit AudioContext
  }
  const ctx = new AudioContext();
  try {
    return await ctx.decodeAudioData(raw.slice(0));
  } catch {
    if (offline) return offline;
    throw new RecordError('Der Klang konnte nicht gelesen werden (Format unbekannt).');
  } finally {
    void ctx.close();
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
      // Angaben für die Fehlersuche auf Geräten ohne Konsole (iOS)
      const info = `${blob.type || 'ohne Typ'}, ${Math.round(blob.size / 1024)} kB, ${decoded.duration.toFixed(1)} s`;
      throw new RecordError(`Die Aufnahme ist still. Ist das richtige Mikrofon gewählt? (${info})`);
    }
    const mono = toMonoResampled(trimmed, decoded.sampleRate, 16000);
    const name = `${prefix}${++this.counter}`;
    this.dataUrls.set(name, toDataUrl(encodeWav(mono, 16000)));
    return name;
  }
}

export const sampleBank = new SampleBank();
