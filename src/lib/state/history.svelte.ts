import { UndoLog } from '../domain/undo.ts';
import type { Track } from '../domain/types.ts';
import { project } from './project.svelte.ts';
import { scenes } from './scenes.svelte.ts';
import { session } from './session.svelte.ts';

interface Snapshot {
  tracks: Track[];
  cps: number;
}

/**
 * Rückgängig für Spuren und Tempo, je Szene ein eigener Verlauf: Szene wählen oder anlegen ist kein Schritt.
 * Nur im Speicher wie die Szenen. Undo/Redo ist offen (`docs/ARCHITECTURE.md`, Abschnitt 4, Punkt 3).
 */
class History {
  private logs = new Map<string, UndoLog<Snapshot>>();
  /** Schritte im Verlauf der gewählten Szene. */
  depth = $state(0);

  /** Aktuellen Zustand festhalten; `App.svelte` ruft das bei jeder Änderung auf. */
  record(): void {
    const id = scenes.currentId;
    // Ohne Proxy: `structuredClone` kopiert keine Proxys
    const snap: Snapshot = { tracks: $state.snapshot(project.tracks), cps: project.cps };
    const key = JSON.stringify(snap);
    const log = this.logs.get(id);
    if (log) log.record(snap, key, performance.now());
    else this.logs.set(id, new UndoLog(snap, key));
    // Gelöschte Szenen brauchen keinen Verlauf mehr
    for (const k of this.logs.keys()) if (!scenes.list.some((s) => s.id === k)) this.logs.delete(k);
    this.depth = this.logs.get(id)?.depth ?? 0;
  }

  undo(): void {
    const log = this.logs.get(scenes.currentId);
    const s = log?.undo();
    if (!log || !s) return;
    session.menu = null;
    session.sheet = null;
    session.dropHint = null;
    this.depth = log.depth;
    project.restore(structuredClone(s.tracks), s.cps);
  }
}

export const history = new History();
