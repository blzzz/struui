/** Mikrofonaufnahme über MediaRecorder. Wirft bei verweigertem Zugriff (z. B. NotAllowedError). */
export interface Recording {
  /** Beendet die Aufnahme. `result` liefert danach die Daten. */
  stop(): void;
  /** Wird abgebrochen und verworfen. */
  cancel(): void;
  result: Promise<Blob | null>;
}

/** Fehler mit einer Meldung, die so in der Oberfläche stehen kann. */
export class RecordError extends Error {
  override name = 'RecordError';
}

/**
 * Formate in der Reihenfolge, in der wir sie versuchen. Safari nimmt nur mp4 auf, Chrome und Firefox webm/ogg.
 * Ohne Angabe wählt der Browser selbst; manche liefern dann ein Format, das `decodeAudioData` nicht lesen kann.
 */
const FORMATS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export async function startRecording(maxSeconds: number, onTick: (seconds: number) => void): Promise<Recording> {
  // Ohne sichere Verbindung (https oder localhost) gibt es `navigator.mediaDevices` gar nicht
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new RecordError(
      'Das Mikrofon geht nur über eine sichere Verbindung (https oder localhost). Über eine Netzwerkadresse wie http://192.168… sperrt der Browser es.',
    );
  }
  if (typeof MediaRecorder === 'undefined') throw new RecordError('Dieser Browser kann nicht aufnehmen (kein MediaRecorder).');

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const mimeType = FORMATS.find((f) => MediaRecorder.isTypeSupported?.(f));
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    throw e;
  }
  const chunks: Blob[] = [];
  let cancelled = false;
  const started = performance.now();

  const result = new Promise<Blob | null>((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => {
      window.clearInterval(ticker);
      stream.getTracks().forEach((t) => t.stop());
      reject(new RecordError('Die Aufnahme ist abgebrochen.'));
    };
    recorder.onstop = () => {
      window.clearInterval(ticker);
      stream.getTracks().forEach((t) => t.stop());
      if (cancelled) return resolve(null);
      if (chunks.length === 0) return reject(new RecordError('Die Aufnahme ist leer. Bitte etwas länger aufnehmen.'));
      resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || '' }));
    };
  });

  const stop = () => {
    if (recorder.state !== 'inactive') recorder.stop();
  };
  const ticker = window.setInterval(() => {
    const s = (performance.now() - started) / 1000;
    onTick(s);
    if (s >= maxSeconds) stop();
  }, 100);

  // Mit Zeitscheibe, damit Safari auch bei kurzen Aufnahmen Daten liefert
  recorder.start(250);
  return {
    stop,
    cancel: () => {
      cancelled = true;
      stop();
    },
    result,
  };
}
