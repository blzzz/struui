import type { EngineHost } from '../audio/engine.ts';
import { StrudelEngine } from '../audio/strudel-engine.ts';
import { project } from './project.svelte.ts';
import { sampleBank } from './sample-bank.svelte.ts';
import { session } from './session.svelte.ts';

const host: EngineHost = {
  getProgram: () => project.program,
  getVolume: () => session.volume,
  setLit: (ids) => {
    session.lit = ids;
  },
  setCycle: (position) => {
    session.cycle = position;
  },
  setStatus: (message) => {
    session.status = message;
  },
};

let engine: StrudelEngine | null = null;

/** Steuert das Abspielen. Strudel wird erst beim ersten Start geladen. */
export const playback = {
  async toggle(): Promise<void> {
    engine ??= new StrudelEngine(host);
    if (session.playing) {
      engine.stop();
      session.playing = false;
      return;
    }
    session.status = null;
    try {
      await engine.start();
      session.playing = true;
    } catch (e) {
      session.status = { kind: 'error', text: `Start fehlgeschlagen: ${(e as Error)?.message ?? e}` };
    }
  },

  /** Einen Klang einmal anspielen (Palette). Lädt Strudel beim ersten Mal. */
  async preview(name: string): Promise<void> {
    engine ??= new StrudelEngine(host);
    try {
      await engine.preview(name, sampleBank.dataUrls.get(name));
    } catch (e) {
      session.status = { kind: 'error', text: `Anspielen fehlgeschlagen: ${(e as Error)?.message ?? e}` };
    }
  },

  /** Hauptlautstärke setzen (0–1). */
  setVolume(volume: number): void {
    session.volume = volume;
    engine?.applyVolume();
  },

  /** Aufrufen, wenn sich der Code ändert. */
  changed(): void {
    if (session.playing) engine?.changed();
  },
};
