import { RecordError, startRecording } from '../audio/recorder.ts';
import type { Recording } from '../audio/recorder.ts';
import { sampleBank } from './sample-bank.svelte.ts';

const MAX_SECONDS = 3;

/** Laufende Aufnahme und letzte Meldung. Eine für die ganze App, Palette und Dialog teilen sie sich. */
class RecordingState {
  active = $state<Recording | null>(null);
  seconds = $state(0);
  /** Fehler der letzten Aufnahme oder Datei, leer = alles gut. */
  message = $state('');

  /** Startet oder beendet die Aufnahme. Liefert den Namen des neuen Klangs, sonst null. */
  async toggle(): Promise<string | null> {
    if (this.active) {
      this.active.stop();
      return null;
    }
    this.message = '';
    this.seconds = 0;
    try {
      const rec = await startRecording(MAX_SECONDS, (s) => (this.seconds = s));
      this.active = rec;
      const blob = await rec.result;
      this.active = null;
      return blob ? await sampleBank.add(blob, 'rec') : null;
    } catch (e) {
      this.active = null;
      this.message = describe(e);
      // Für die Fehlersuche: die Meldung des Browsers in der Konsole
      console.error('Aufnahme', e);
      return null;
    }
  }

  /** Eine Audiodatei laden. Liefert den Namen des neuen Klangs, sonst null. */
  async load(file: File): Promise<string | null> {
    this.message = '';
    try {
      return await sampleBank.add(file, 'smp');
    } catch (e) {
      this.message = e instanceof RecordError ? e.message : 'Diese Datei konnte nicht gelesen werden.';
      console.error('Datei laden', e);
      return null;
    }
  }

  cancel(): void {
    this.active?.cancel();
    this.active = null;
  }
}

function describe(e: unknown): string {
  if (e instanceof RecordError) return e.message;
  const err = e as Error | undefined;
  const name = err?.name ?? 'Fehler';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Kein Zugriff aufs Mikrofon. Erlaube es in den Einstellungen des Browsers. In eingebetteten Seiten kann es ganz gesperrt sein; lade dann eine Datei.';
  }
  if (name === 'NotFoundError') return 'Kein Mikrofon gefunden.';
  if (name === 'NotReadableError') return 'Das Mikrofon wird gerade von einem anderen Programm benutzt.';
  return `Aufnahme nicht möglich: ${name}${err?.message ? ` – ${err.message}` : ''}`;
}

export const recording = new RecordingState();
