import { restoreTracks, snapshot, snapshotName } from '../domain/snapshot.ts';
import type { Snapshot } from '../domain/snapshot.ts';
import { project } from './project.svelte.ts';
import { session } from './session.svelte.ts';

/**
 * Festgehaltene Zustände des ganzen Projekts. Nur im Speicher, beim Neuladen sind sie weg
 * (Persistenz ist offen, siehe `docs/ARCHITECTURE.md`, Abschnitt 4).
 */
class Snapshots {
  list = $state<Snapshot[]>([]);

  /** Der Snapshot, dessen Code gerade läuft (oder null). */
  current = $derived(this.list.find((s) => s.code === project.codeFull) ?? null);

  /** Hält den aktuellen Zustand fest, wenn er gültig ist. Gibt die ID zurück. */
  take(): string | null {
    if (!project.valid) return null;
    const s = snapshot(snapshotName(this.list), $state.snapshot(project.tracks), project.cps, project.codeFull);
    this.list.push(s);
    return s.id;
  }

  load(id: string): void {
    const s = this.list.find((x) => x.id === id);
    if (!s) return;
    session.menu = null;
    session.sheet = null;
    session.dropHint = null;
    // Ohne Proxy: `structuredClone` kopiert keine Proxys
    project.restore(restoreTracks($state.snapshot(s)), s.cps);
  }

  rename(id: string, name: string): void {
    const s = this.list.find((x) => x.id === id);
    if (s) s.name = name.trim() || s.name;
  }

  remove(id: string): void {
    this.list = this.list.filter((s) => s.id !== id);
  }
}

export const snapshots = new Snapshots();
