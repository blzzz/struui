import type { EngineHost } from '../audio/engine.ts';
import { StrudelEngine } from '../audio/strudel-engine.ts';
import { splitVariant } from '../domain/sounds.ts';
import type { Program } from '../domain/codegen.ts';
import { arrangement } from './arrangement.svelte.ts';
import { project } from './project.svelte.ts';
import { sampleBank } from './sample-bank.svelte.ts';
import { session } from './session.svelte.ts';

const host: EngineHost = {
  getProgram: () => program(),
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

/** Was spielt: die gewählte Szene oder das Arrangement. */
function program(): Program {
  return session.playMode === 'arrangement' ? arrangement.arranged : project.program;
}

async function start(): Promise<void> {
  engine ??= new StrudelEngine(host);
  session.status = null;
  try {
    await engine.start();
    session.playing = true;
  } catch (e) {
    session.status = { kind: 'error', text: `Start fehlgeschlagen: ${(e as Error)?.message ?? e}` };
  }
}

function stop(): void {
  engine?.stop();
  session.playing = false;
}

/** Steuert das Abspielen. Strudel wird erst beim ersten Start, Anspielen oder Vorladen geladen. */
export const playback = {
  /** Was gerade spielt bzw. beim Start spielen würde. Liest reaktiv, für den Effekt in `App.svelte`. */
  program,

  /**
   * Play oben: die gewählte Szene. Spielt gerade das Arrangement, wechselt die Wiedergabe ohne Neustart auf die Szene.
   */
  async toggle(): Promise<void> {
    if (session.playing && session.playMode === 'scene') return stop();
    session.playMode = 'scene';
    if (session.playing) engine?.changed();
    else await start();
  },

  /**
   * ▶ vor dem Arrangement: spielt das Arrangement von vorn. Läuft schon die Szene, wird Strudel angehalten und neu
   * gestartet, damit `arrange()` beim ersten Abschnitt beginnt (Strudel setzt beim Anhalten den Zyklus auf 0).
   */
  async toggleArrangement(): Promise<void> {
    if (session.playing && session.playMode === 'arrangement') return stop();
    if (session.playing) stop();
    session.playMode = 'arrangement';
    await start();
  },

  /** Arrangement ausgeblendet: spielt es gerade, läuft die Szene weiter. */
  leaveArrangement(): void {
    if (session.playMode !== 'arrangement') return;
    session.playMode = 'scene';
    if (session.playing) engine?.changed();
  },

  /** Einen Klang einmal anspielen (Palette, Stein), auch eine Variante (`bd:3`), bei `note` in dieser Tonhöhe. Lädt Strudel beim ersten Mal. */
  async preview(sound: string, note?: string): Promise<void> {
    engine ??= new StrudelEngine(host);
    const { name, variant } = splitVariant(sound);
    try {
      await engine.preview(name, sampleBank.dataUrls.get(name), note, variant);
    } catch (e) {
      session.status = { kind: 'error', text: `Anspielen fehlgeschlagen: ${(e as Error)?.message ?? e}` };
    }
  },

  /**
   * Samples eines Klangs (auch `bd:3`) vorladen, danach seine übrigen Varianten. Für Klangsteine, die sichtbar werden.
   * Eigene Aufnahmen nicht: Sie stecken als Data-URL im Code und brauchen kein Netz.
   */
  preload(sound: string): void {
    const { name, variant } = splitVariant(sound);
    if (sampleBank.dataUrls.has(name)) return;
    engine ??= new StrudelEngine(host);
    void engine.preload(name, variant);
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
