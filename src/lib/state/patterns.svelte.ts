import { EMPTY_STORE, byRecent, patternName, readStore, removePattern, savePattern } from '../domain/patterns.ts';
import type { PatternStore } from '../domain/patterns.ts';
import { programToTracks } from '../syntax/from-program.ts';
import { arrangement } from './arrangement.svelte.ts';
import { board } from './board.svelte.ts';
import { project } from './project.svelte.ts';
import { sampleBank } from './sample-bank.svelte.ts';
import { scenes } from './scenes.svelte.ts';
import { session } from './session.svelte.ts';

const KEY = 'strudel-steine:patterns';
/** So lange nach der letzten Änderung wird gespeichert. */
const SAVE_MS = 400;

const newPatternId = () => `pat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Patterns im localStorage: je Pattern der Code der gewählten Szene mit Lage der Spuren und Aufnahmen
 * (`domain/patterns.ts`). Jede Änderung wird kurz danach ins aktuelle Pattern gespeichert (`App.svelte`),
 * beim Neuladen kommt es wieder. Szenen, Arrangement und alles, was nicht im Code steht, gehen dabei verloren.
 */
class Patterns {
  private store = $state<PatternStore>(EMPTY_STORE);
  /** Geändert, aber noch nicht gespeichert: Code und Pattern, zu dem er gehört. */
  private pending: { id: string; code: string } | null = null;
  private timer = 0;

  list = $derived(byRecent(this.store.patterns));
  current = $derived(this.store.patterns.find((p) => p.id === this.store.current) ?? null);

  /** Was gespeichert wird: Code wie «Code kopieren», ohne Solo. */
  code = $derived(board.comment ? `${project.codeSaved}\n\n${board.comment}` : project.codeSaved);

  /** Beim Start: das zuletzt aktuelle Pattern laden, sonst den Anfangszustand als erstes Pattern anlegen. */
  init(): void {
    let text: string | null = null;
    try {
      text = localStorage.getItem(KEY);
    } catch {
      // Gesperrter Speicher (privates Fenster): dann gibt es nur den Anfangszustand
    }
    this.store = readStore(text);
    const current = this.current;
    if (current && this.apply(current.code)) return;
    this.write(savePattern(this.store, { id: newPatternId(), name: patternName(this.names()), code: this.code, updated: Date.now() }));
  }

  /** Änderung vormerken, gespeichert wird `SAVE_MS` später (oder vor dem Wechsel zu einem anderen Pattern). */
  changed(code: string): void {
    const p = this.current;
    if (!p || p.code === code) return;
    this.pending = { id: p.id, code };
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.flush(), SAVE_MS);
  }

  /** Vorgemerkte Änderung sofort speichern. */
  flush(): void {
    clearTimeout(this.timer);
    const p = this.pending;
    this.pending = null;
    const pattern = p && this.store.patterns.find((x) => x.id === p.id);
    if (!p || !pattern) return;
    // Gehört die Änderung zu einem anderen als dem aktuellen, bleibt das aktuelle aktuell
    const next = savePattern(this.store, { ...pattern, code: p.code, updated: Date.now() });
    this.write({ ...next, current: this.store.current });
  }

  /** Neues, leeres Pattern (eine leere Klangspur). */
  create(): void {
    this.flush();
    this.apply('');
    this.write(savePattern(this.store, { id: newPatternId(), name: patternName(this.names()), code: this.code, updated: Date.now() }));
  }

  load(id: string): void {
    this.flush();
    const p = this.store.patterns.find((x) => x.id === id);
    if (!p || !this.apply(p.code)) return;
    this.write({ ...this.store, current: id });
  }

  rename(name: string): void {
    const p = this.current;
    const trimmed = name.trim();
    if (!p || !trimmed || trimmed === p.name) return;
    this.write(savePattern(this.store, { ...p, name: trimmed }));
  }

  /** Entfernen. War es das aktuelle, kommt das zuletzt gespeicherte andere, sonst ein neues. */
  remove(id: string): void {
    this.flush();
    const next = removePattern(this.store, id);
    this.write(next);
    if (next.current) return;
    const other = byRecent(next.patterns)[0];
    if (other) this.load(other.id);
    else this.create();
  }

  private names(): string[] {
    return this.store.patterns.map((p) => p.name);
  }

  /** Code einlesen und alles andere zurücksetzen. Ungültiger Code: Meldung, nichts ändert sich. */
  private apply(code: string): boolean {
    const r = programToTracks(code);
    if (!r.ok) {
      session.status = { kind: 'error', text: `Das Pattern konnte nicht gelesen werden: ${r.message}` };
      return false;
    }
    session.menu = null;
    session.sheet = null;
    session.dropHint = null;
    session.selection = null;
    session.solo = new Set();
    arrangement.active = false;
    arrangement.sections = [];
    sampleBank.replace(r.recordings);
    project.loadProgram(r);
    board.selected = null;
    if (r.board) board.place(r.board);
    scenes.reset();
    return true;
  }

  private write(next: PatternStore): void {
    this.store = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch (e) {
      const full = e instanceof DOMException && e.name === 'QuotaExceededError';
      session.status = {
        kind: 'error',
        text: full
          ? 'Speichern nicht möglich: der Speicher des Browsers ist voll (Aufnahmen brauchen viel Platz). Alte Patterns löschen.'
          : 'Speichern nicht möglich: der Browser erlaubt keinen Speicher (privates Fenster?).',
      };
    }
  }
}

export const patterns = new Patterns();
