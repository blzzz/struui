/** Mono, 16 Bit PCM als WAV-Datei. Rein, ohne Browser-APIs. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const n = samples.length;
  const bytes = new Uint8Array(44 + n * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return bytes;
}

export function toDataUrl(bytes: Uint8Array, mime = 'audio/wav'): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

/** Kanäle zu Mono mischen und auf `targetRate` herunterrechnen (Mittelwert pro Fenster). */
export function toMonoResampled(channels: Float32Array[], sourceRate: number, targetRate: number): Float32Array {
  const length = channels[0].length;
  const ratio = sourceRate / targetRate;
  const n = Math.max(1, Math.floor(length / ratio));
  const mono = new Float32Array(length);
  for (const ch of channels) for (let i = 0; i < length; i += 1) mono[i] += ch[i] / channels.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const a = Math.floor(i * ratio);
    const b = Math.min(length, Math.max(a + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = a; j < b; j += 1) sum += mono[j];
    out[i] = sum / (b - a);
  }
  return out;
}

/** Stille am Anfang und Ende kürzen, auf `maxSeconds` begrenzen, Lautstärke angleichen. */
export function trimAndNormalize(channels: Float32Array[], sampleRate: number, maxSeconds = 3): Float32Array[] {
  const first = channels[0];
  let peak = 0;
  for (const ch of channels) for (let i = 0; i < ch.length; i += 1) peak = Math.max(peak, Math.abs(ch[i]));
  if (peak < 0.001) throw new Error('empty');
  const threshold = peak * 0.08;
  let a = 0;
  let b = first.length - 1;
  while (a < b && Math.abs(first[a]) < threshold) a += 1;
  while (b > a && Math.abs(first[b]) < threshold) b -= 1;
  a = Math.max(0, a - 300);
  b = Math.min(first.length, b + 2000);
  b = Math.min(b, a + Math.floor(sampleRate * maxSeconds));
  const gain = 0.9 / peak;
  return channels.map((ch) => {
    const out = new Float32Array(b - a);
    for (let i = 0; i < out.length; i += 1) out[i] = ch[a + i] * gain;
    return out;
  });
}
