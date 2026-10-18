import { restoreTracks, sameContent, scene, sceneName, withContent } from '../domain/scene.ts';
import type { Scene } from '../domain/scene.ts';
import { project } from './project.svelte.ts';
import { session } from './session.svelte.ts';

/**
 * Szenen des ganzen Projekts. Es gibt immer mindestens eine und genau eine ist gewählt; das Bearbeiten wirkt auf sie.
 * Nur im Speicher, beim Neuladen sind sie weg (Persistenz ist offen, siehe `docs/ARCHITECTURE.md`, Abschnitt 4).
 */
class Scenes {
  list = $state<Scene[]>([scene(sceneName([]), $state.snapshot(project.tracks), project.cps)]);
  currentId = $state(this.list[0].id);

  /**
   * An: jede Änderung landet sofort in der gewählten Szene (`App.svelte`).
   * Aus: erst «Übernehmen» schreibt sie hinein; vor Wählen und Anlegen fragt `SceneDock.svelte` nach.
   */
  autoUpdate = $state(true);

  current = $derived(this.list.find((s) => s.id === this.currentId) ?? this.list[0]);

  /** Der Zustand weicht von der gewählten Szene ab. */
  dirty = $derived(!sameContent(this.current, project.tracks, project.cps));

  /** Schreibt den aktuellen Zustand in die gewählte Szene. */
  update(): void {
    const i = this.list.findIndex((s) => s.id === this.current.id);
    if (i < 0) return;
    // Ohne Proxy: `structuredClone` kopiert keine Proxys
    this.list[i] = withContent(this.list[i], $state.snapshot(project.tracks), project.cps);
  }

  /** Neue Szene als Kopie des aktuellen Zustands, gleich hinter der gewählten. Sie wird gewählt. Gibt die ID zurück. */
  duplicate(): string {
    const s = scene(sceneName(this.list), $state.snapshot(project.tracks), project.cps);
    const i = this.list.findIndex((x) => x.id === this.current.id);
    this.list.splice(i + 1, 0, s);
    this.currentId = s.id;
    return s.id;
  }

  select(id: string): void {
    const s = this.list.find((x) => x.id === id);
    if (!s) return;
    session.menu = null;
    session.sheet = null;
    session.dropHint = null;
    this.currentId = id;
    project.restore(restoreTracks($state.snapshot(s)), s.cps);
  }

  rename(id: string, name: string): void {
    const s = this.list.find((x) => x.id === id);
    if (s) s.name = name.trim() || s.name;
  }

  /** Die letzte Szene bleibt. Fällt die gewählte weg, wird die Nachbarin gewählt und geladen. */
  remove(id: string): void {
    if (this.list.length <= 1) return;
    const i = this.list.findIndex((s) => s.id === id);
    if (i < 0) return;
    this.list.splice(i, 1);
    if (id === this.currentId) this.select(this.list[Math.min(i, this.list.length - 1)].id);
  }
}

export const scenes = new Scenes();
