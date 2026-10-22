import { clampTimes, insertSection, moveSection, positionAt, sceneVariables, section } from '../domain/arrangement.ts';
import type { Section } from '../domain/arrangement.ts';
import { toArrangedProgram } from '../domain/codegen.ts';
import type { CodeScene, CodeTrack } from '../domain/codegen.ts';
import type { Scene } from '../domain/scene.ts';
import { analyze } from '../syntax/analyze.ts';
import { board } from './board.svelte.ts';
import { codeTracksOf, project } from './project.svelte.ts';
import { sampleBank } from './sample-bank.svelte.ts';
import { scenes } from './scenes.svelte.ts';
import { session } from './session.svelte.ts';

/** Ziel-ID der Arrangement-Zeile für `findDropTarget` (`data-lane`, `data-drop-lane`). */
export const ARRANGEMENT_LANE = 'arrangement';

/** Code-Spuren einer gespeicherten Szene, einmal pro Szenen-Objekt (eine Änderung ersetzt das Objekt, `withContent`). */
const cache = new WeakMap<Scene, CodeTrack[]>();
function codeTracksOfScene(s: Scene): CodeTrack[] {
  let tracks = cache.get(s);
  if (!tracks) {
    const errors = new Map(
      s.tracks.flatMap((t) =>
        [{ id: t.id, tokens: t.tokens }, t.voice, t.sample, ...t.noteOps, ...t.effects].map(
          (r) => [r.id, analyze(r.tokens).errors.length] as const,
        ),
      ),
    );
    tracks = codeTracksOf(s.tracks, (id) => errors.get(id) === 0);
    cache.set(s, tracks);
  }
  return tracks;
}

/**
 * Arrangement der Szenen: alle Szenen als Variablen mit `arrange(…)`. Eingeschaltet (`active`) zeigen Leiste und
 * Code-Ansicht das Arrangement; was klingt, entscheidet der Play-Knopf (`playback`). Die Abschnitte bleiben beim Ausschalten.
 */
class Arrangement {
  active = $state(false);
  sections = $state<Section[]>([]);
  /** Einfügestelle beim Ziehen in die Zeile, sonst null. */
  hint = $state<number | null>(null);

  /** Die gewählte Szene mit dem aktuellen Stand (auch nicht übernommene Änderungen), die anderen wie gespeichert. */
  private codeScenes = $derived.by<CodeScene[]>(() => {
    const variables = sceneVariables(scenes.list.map((s) => s.name));
    return scenes.list.map((s, i) => ({
      id: s.id,
      variable: variables[i],
      tracks: s.id === scenes.current.id ? project.codeTracks : codeTracksOfScene(s),
    }));
  });

  /** Das Arrangement als Programm. Spielt, wenn ▶ vor dem Arrangement läuft (`playback`). */
  arranged = $derived(
    toArrangedProgram(this.codeScenes, this.sections, {
      cps: project.cps,
      tempoUnit: project.tempoUnit,
      samples: sampleBank.dataUrls,
      frame: project.frame,
      lit: scenes.current.id,
    }),
  );

  /** Während das Arrangement spielt: der laufende Abschnitt und der Fortschritt im ganzen Durchlauf (0–1). */
  position = $derived(
    session.playing && session.playMode === 'arrangement' && session.cycle !== null
      ? positionAt(this.sections, session.cycle)
      : null,
  );

  /** Voller Code zum Kopieren und für den Link, mit der Lage der Spuren. Folgt dem Schalter, nicht der Wiedergabe. */
  codeFull = $derived(withBoard(this.active ? this.arranged.code : project.codeFull));

  /** Gekürzter Code für die Anzeige, mit der Lage der Spuren. */
  codeDisplay = $derived(
    withBoard(this.active
      ? toArrangedProgram(this.codeScenes, this.sections, {
          cps: project.cps,
          tempoUnit: project.tempoUnit,
          samples: sampleBank.dataUrls,
          elideSamples: true,
          frame: project.frame,
        }).code
      : project.codeDisplay),
  );

  /** Variablenname je Szene, wie er im Code steht. */
  variable(sceneId: string): string {
    return this.codeScenes.find((s) => s.id === sceneId)?.variable ?? '';
  }

  add(sceneId: string, index = this.sections.length): void {
    insertSection(this.sections, index, section(sceneId));
  }

  move(id: string, index: number): void {
    moveSection(this.sections, id, index);
  }

  /** Szene entfernen, mit ihren Abschnitten. */
  removeScene(sceneId: string): void {
    scenes.remove(sceneId);
    if (scenes.list.some((s) => s.id === sceneId)) return;
    this.sections = this.sections.filter((x) => x.sceneId !== sceneId);
  }

  remove(id: string): void {
    this.sections = this.sections.filter((x) => x.id !== id);
  }

  setTimes(id: string, times: number): void {
    const x = this.sections.find((s) => s.id === id);
    if (x) x.times = clampTimes(times);
  }
}

/**
 * Der Sammelkommentar mit der Lage der Spuren am Ende des Codes. Nur für Anzeige, Kopieren und Link: was Strudel spielt
 * (`program`, `arranged`), hat ihn nicht, sonst würde jedes Verschieben neu ausgewertet.
 */
function withBoard(code: string): string {
  return board.comment ? `${code}\n\n${board.comment}` : code;
}

export const arrangement = new Arrangement();
