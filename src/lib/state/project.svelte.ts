import { toStrudelCode, toStrudelProgram } from '../domain/codegen.ts';
import { adoptIds, insertPair, moveToken, removeAt, replaceAt, setGroup, unwrapAt, wrapAt, wrapRange } from '../domain/edit.ts';
import { defaultValue, effectInfo, noteOpInfo, singleValue, valueInfo } from '../domain/effects.ts';
import type { Effect, EffectInfo, SliderRange } from '../domain/effects.ts';
import { DEFAULT_SAMPLE, clampSlices, samplerInfo, startValues } from '../domain/sampler.ts';
import type { SamplerMode } from '../domain/sampler.ts';
import { DEFAULT_VOICE } from '../domain/notes.ts';
import type { ParseResult } from '../domain/parse.ts';
import type { TempoUnit } from '../domain/tempo.ts';
import { DEFAULT_BANG, DEFAULT_RANDOM, DEFAULT_STAR } from '../domain/scales.ts';
import {
  CHANNEL_MAX,
  ORBIT_MAX,
  PAUSE,
  VOLUME_MAX,
  closeToken,
  contentOf,
  effect,
  nextInCycle,
  openToken,
  soundToken,
  track,
  trackName,
} from '../domain/types.ts';
import { analyze } from '../syntax/analyze.ts';
import type { CodeLine, ValueRow } from '../syntax/from-code.ts';
import type { CodeTrack } from '../domain/codegen.ts';
import type { GroupType, Token, Track, TrackContent, TrackType } from '../domain/types.ts';
import { sampleBank } from './sample-bank.svelte.ts';

/** Erste Note einer neuen Notenspur und des + in einer leeren Notenreihe. */
const FIRST_NOTE = 'c';

export type PlaceMode = 'replace' | 'insert';

/** Wertreihen einer Spur: Effekte (`.lpf(800)`) oder Rechenarten für Noten (`note("c".add(3))`). */
export type RowKind = 'effects' | 'noteOps';

/** Wertreihen aus geparstem Code übernehmen. Gleicher Name an gleicher Stelle behält die IDs von Reihe und Steinen. */
function adoptRows(old: readonly Effect[], next: readonly ValueRow[]): Effect[] {
  return next.map((n, i) => {
    const o = old[i];
    if (o?.name !== n.name) return { ...effect(n.name, n.tokens), slider: n.slider };
    adoptIds(o.tokens, n.tokens);
    // Ohne slider() im Code bleibt ein eingestellter Bereich, solange der Wert Mini-Notation ist (dort steht er nie im Code)
    const keep = n.slider ?? (singleValue(n.tokens) === null ? (o.slider ?? null) : null);
    return { id: o.id, name: n.name, tokens: n.tokens, slider: keep };
  });
}

/** Was in der Palette unter einer Spur liegt: ein Klang (auch Pause) oder ein Klammerpaar. */
export type PaletteItem = { kind: 'sound'; name: string };

/** Was auf den Steinen einer Reihe liegt. Ziehen geht nur zwischen Reihen mit gleichem Inhalt. */
export type LaneContent = TrackContent;

/**
 * Eine Steinreihe: die Klänge, Noten oder (Sampler-Spur) Werte einer Spur (ID der Spur), der Klang einer Notenspur
 * (ID von `track.voice`), das Sample einer Sampler-Spur (ID von `track.sample`) oder die Werte eines Effekts (ID des Effekts).
 * Alle bearbeiten sich gleich; nur was auf den Steinen steht, unterscheidet sich.
 */
export interface Lane {
  tokens: Token[];
  track: Track;
  /** null = Hauptreihe der Spur. Beim Klang einer Notenspur `track.voice`, beim Sample einer Sampler-Spur `track.sample`. */
  effect: Effect | null;
  content: LaneContent;
  /** Bei Werten: Beschreibung und Beispielwerte (Effekt, Rechenart oder Sampler-Art), sonst null. */
  info: EffectInfo | null;
}

function startTracks(): Track[] {
  return [
    track(
      [
        soundToken('bd'),
        soundToken('hh', { repeat: { op: '*', value: 2 } }),
        soundToken('sd'),
        openToken('['),
        soundToken('hh'),
        soundToken('oh'),
        closeToken('['),
      ],
      'drums',
    ),
    track(),
  ];
}

/** Der Projektzustand: Spuren, Tempo und alles, was daraus abgeleitet wird. */
class Project {
  tracks = $state<Track[]>(startTracks());
  cps = $state(0.5);
  /** Einheit, in der das Tempo angezeigt, eingegeben und in den Code geschrieben wird. */
  tempoUnit = $state<TempoUnit>('bpm');

  /** Pro Reihe (Spur oder Effekt): Baum, Fehler und Gruppentiefe. */
  parsed = $derived(
    new Map<string, ParseResult>(
      this.tracks.flatMap((t) => [
        [t.id, analyze(t.tokens)] as const,
        [t.voice.id, analyze(t.voice.tokens)] as const,
        [t.sample.id, analyze(t.sample.tokens)] as const,
        ...t.noteOps.map((o) => [o.id, analyze(o.tokens)] as const),
        ...t.effects.map((e) => [e.id, analyze(e.tokens)] as const),
      ]),
    ),
  );

  /** Was in den Code geht: Effekte mit Klammerfehler bleiben weg, damit die Spur weiterläuft. */
  private codeTracks = $derived<CodeTrack[]>(
    this.tracks.map((t) => ({
      tokens: t.tokens,
      name: t.name,
      muted: t.muted,
      volume: t.volume,
      type: t.type,
      orbit: t.orbit,
      channel: t.channel,
      port: t.port,
      voice: this.parsed.get(t.voice.id)?.errors.length === 0 ? t.voice : null,
      sample: this.parsed.get(t.sample.id)?.errors.length === 0 ? t.sample : null,
      samplerMode: t.samplerMode,
      slices: t.slices,
      noteOps: t.noteOps.filter((o) => this.parsed.get(o.id)?.errors.length === 0),
      effects: t.effects.filter((e) => this.parsed.get(e.id)?.errors.length === 0),
    })),
  );

  /** Code samt Positionen der Klang- und Wertsteine. Das spielt Strudel ab. */
  program = $derived(toStrudelProgram(this.codeTracks, { cps: this.cps, tempoUnit: this.tempoUnit, samples: sampleBank.dataUrls }));

  /** Voller Code zum Kopieren und für den Link. */
  codeFull = $derived(this.program.code);

  /** Gekürzter Code für die Anzeige. */
  codeDisplay = $derived(
    toStrudelCode(this.codeTracks, { cps: this.cps, tempoUnit: this.tempoUnit, samples: sampleBank.dataUrls, elideSamples: true }),
  );

  /** Keine Reihe (Spur oder Effekt) hat einen Fehler und mindestens eine Spur hat Steine. Nur dann lässt sich festhalten. */
  valid = $derived(
    [...this.parsed.values()].every((p) => p.errors.length === 0) && this.tracks.some((t) => t.tokens.length > 0),
  );

  /** Ganzen Zustand ersetzen (Snapshot laden). */
  restore(tracks: Track[], cps: number): void {
    this.tracks = tracks;
    this.cps = cps;
  }

  parsedOf(laneId: string): ParseResult {
    return this.parsed.get(laneId) ?? analyze([]);
  }

  private find(trackId: string) {
    return this.tracks.find((t) => t.id === trackId);
  }

  lane(laneId: string): Lane | null {
    for (const t of this.tracks) {
      if (t.id === laneId) {
        const info = t.type === 'sampler' ? samplerInfo(t.samplerMode, t.slices) : null;
        return { tokens: t.tokens, track: t, effect: null, content: contentOf(t.type), info };
      }
      if (t.voice.id === laneId) return { tokens: t.voice.tokens, track: t, effect: t.voice, content: 'sounds', info: null };
      if (t.sample.id === laneId) return { tokens: t.sample.tokens, track: t, effect: t.sample, content: 'sounds', info: null };
      const e = t.effects.find((x) => x.id === laneId) ?? t.noteOps.find((x) => x.id === laneId);
      if (e) return { tokens: e.tokens, track: t, effect: e, content: 'values', info: valueInfo(e.name) ?? null };
    }
    return null;
  }

  /** Inhalt einer Reihe, null wenn es sie nicht gibt. Paletten legen nur in passende Reihen ab. */
  contentOf(laneId: string): LaneContent | null {
    return this.lane(laneId)?.content ?? null;
  }

  indexOf(laneId: string, tokenId: string): number {
    return this.lane(laneId)?.tokens.findIndex((t) => t.id === tokenId) ?? -1;
  }

  /** Neue Spur der gewählten Art ans Ende. Klangspuren sind leer, Notenspuren beginnen mit einem c, Sampler-Spuren mit vier Stellen. */
  addTrack(type: TrackType = 'sound'): void {
    const t = { ...track(), type };
    t.tokens = this.startTokens(t);
    this.tracks.push(t);
  }

  /** Steine einer Spur, die zum ersten Mal diesen Inhalt bekommt. */
  private startTokens(t: Track): Token[] {
    if (t.type === 'note') return [soundToken(FIRST_NOTE)];
    if (t.type === 'sampler') return startValues(t.samplerMode).map((v) => soundToken(v));
    return [];
  }

  /** Steine für den Inhalt einer anderen Art: die geparkten, die bisherigen kommen ins Parkfach. */
  private swapContent(t: Track, next: TrackContent): void {
    const now = contentOf(t.type);
    if (now === next) return;
    const back = t.parked[next];
    t.parked = { ...t.parked, [now]: t.tokens, [next]: undefined };
    t.tokens = back ?? [];
  }

  /** Neuer Name (bereinigt, siehe `trackName`). */
  rename(trackId: string, raw: string): void {
    const t = this.find(trackId);
    if (t) t.name = trackName(raw);
  }

  /**
   * Die ganze Spur aus ihrer bearbeiteten Codezeile. Gleichartige Steine an gleicher Stelle behalten ihre ID,
   * ebenso Effekte mit gleichem Namen an gleicher Stelle.
   */
  applyCode(trackId: string, line: CodeLine): void {
    const t = this.find(trackId);
    if (!t) return;
    t.name = line.name;
    t.muted = line.muted;
    // Wechselt der Inhalt (Klänge, Noten, Werte), die bisherigen Steine für das Zurückwechseln aufheben
    if (contentOf(line.type) !== contentOf(t.type)) t.parked = { ...t.parked, [contentOf(t.type)]: t.tokens };
    t.type = line.type;
    if (line.sample) {
      adoptIds(t.sample.tokens, line.sample.tokens);
      t.sample.tokens = line.sample.tokens;
      t.samplerMode = line.samplerMode;
      t.slices = line.slices;
    }
    if (line.voice) {
      adoptIds(t.voice.tokens, line.voice.tokens);
      t.voice.tokens = line.voice.tokens;
    } else if (line.type === 'note') {
      t.voice.tokens = [];
    }
    // Was die andere Art von Spur einstellt, bleibt für das Zurückwechseln erhalten
    if (line.type !== 'midi') {
      t.volume = Math.max(0, Math.min(VOLUME_MAX, line.volume));
      t.orbit = line.orbit;
    } else {
      t.channel = line.channel;
      t.port = line.port;
    }
    adoptIds(t.tokens, line.tokens);
    t.tokens = line.tokens;
    t.effects = adoptRows(t.effects, line.effects);
    // Rechenarten stehen nur bei Notenspuren im Code; sonst bleiben die gespeicherten
    if (line.type === 'note') t.noteOps = adoptRows(t.noteOps, line.noteOps);
  }

  setVolume(trackId: string, volume: number): void {
    const t = this.find(trackId);
    if (t) t.volume = Math.max(0, Math.min(VOLUME_MAX, volume));
  }

  /** Klang- oder MIDI-Spur. Lautstärke, Orbit, Kanal und Ausgang bleiben gespeichert, es gilt nur, was zur Art passt. */
  setType(trackId: string, type: TrackType): void {
    const t = this.find(trackId);
    if (!t) return;
    // Klänge, Noten und Werte haben eigene Steine; die der anderen Arten warten in `parked`
    const changed = contentOf(type) !== contentOf(t.type);
    this.swapContent(t, contentOf(type));
    t.type = type;
    // Zum ersten Mal Noten oder Werte: wie eine neue Spur dieser Art beginnen
    if (changed && t.tokens.length === 0) t.tokens = this.startTokens(t);
  }

  /**
   * Sampler-Spur: Positionen (`scrub`) oder Abschnitte (`slice`). Die Steine bleiben; nur Werte, die in der neuen Art keinen
   * Sinn ergeben, werden umgerechnet: Abschnitt 2 von 8 wird Position 0.25 und umgekehrt (auf den nächsten Abschnitt gerundet).
   */
  setSamplerMode(trackId: string, mode: SamplerMode): void {
    const t = this.find(trackId);
    if (!t || t.samplerMode === mode) return;
    const n = clampSlices(t.slices);
    for (const token of t.tokens) {
      if (token.kind !== 'sound' || token.sound === PAUSE) continue;
      const v = Number(token.sound);
      if (!Number.isFinite(v)) continue;
      token.sound = mode === 'scrub' ? String(Math.round((v / n) * 1000) / 1000) : String(Math.min(n - 1, Math.max(0, Math.round(v * n))));
    }
    t.samplerMode = mode;
  }

  /** Sampler-Spur mit `slice`: Zahl der Abschnitte (1 bis `SLICES_MAX`). */
  setSlices(trackId: string, slices: number): void {
    const t = this.find(trackId);
    if (t) t.slices = clampSlices(slices);
  }

  /** Orbit eins höher, nach dem letzten wieder 1. */
  cycleOrbit(trackId: string): void {
    const t = this.find(trackId);
    if (t) t.orbit = nextInCycle(t.orbit, ORBIT_MAX);
  }

  /** MIDI-Kanal eins höher, nach 16 wieder 1. */
  cycleChannel(trackId: string): void {
    const t = this.find(trackId);
    if (t) t.channel = nextInCycle(t.channel, CHANNEL_MAX);
  }

  /** MIDI-Ausgang nach Namen, leer = Strudel wählt. */
  setPort(trackId: string, port: string): void {
    const t = this.find(trackId);
    if (t) t.port = port;
  }

  toggleMute(trackId: string): void {
    const t = this.find(trackId);
    if (t) t.muted = !t.muted;
  }

  removeTrack(trackId: string): void {
    this.tracks = this.tracks.filter((t) => t.id !== trackId);
  }

  /**
   * Effekt (oder bei `noteOps` eine Rechenart für Noten) ans Ende der Spur hängen, mit einem Wert aus Strudels Beispielen.
   * Gibt die ID zurück und ob er leer ist (dann fragt die Oberfläche nach einem Wert).
   */
  addEffect(trackId: string, name: string, kind: RowKind = 'effects'): { id: string; empty: boolean } | null {
    const t = this.find(trackId);
    const info = kind === 'effects' ? effectInfo(name) : noteOpInfo(name);
    if (!t || !info) return null;
    const start = defaultValue(info);
    const e = effect(name, start === null ? [] : [soundToken(start)]);
    t[kind].push(e);
    return { id: e.id, empty: start === null && !info.noValue };
  }

  removeEffect(trackId: string, effectId: string, kind: RowKind = 'effects'): void {
    const t = this.find(trackId);
    if (t) t[kind] = t[kind].filter((e) => e.id !== effectId);
  }

  /** Effekt innerhalb der Spur verschieben. `toIndex` ist die Einfügeposition vor dem Entfernen. */
  moveEffect(trackId: string, effectId: string, toIndex: number, kind: RowKind = 'effects'): void {
    const list = this.find(trackId)?.[kind];
    const from = list?.findIndex((e) => e.id === effectId) ?? -1;
    if (!list || from < 0) return;
    const [e] = list.splice(from, 1);
    list.splice(Math.max(0, from < toIndex ? toIndex - 1 : toIndex), 0, e);
  }

  /** Wert eines Effekts über den Regler: danach liegt genau ein Stein darin. Ein einzelner Stein behält seine ID. */
  setEffectValue(effectId: string, value: string): void {
    const lane = this.lane(effectId);
    if (!lane?.effect) return;
    const only = lane.tokens.length === 1 ? lane.tokens[0] : null;
    if (only?.kind === 'sound') {
      only.sound = value;
      only.random = null;
      only.repeat = null;
    } else {
      lane.effect.tokens = [soundToken(value)];
    }
  }

  /** Bereich des Reglers setzen (danach steht der Wert als `slider()` im Code) oder entfernen (null, wieder eine Zahl). */
  setEffectSlider(effectId: string, range: SliderRange | null): void {
    const e = this.lane(effectId)?.effect;
    if (e) e.slider = range;
  }

  /** Klang oder Wert anhängen (tokenId null), davor einfügen oder den Stein ersetzen. */
  placeSound(laneId: string, tokenId: string | null, mode: PlaceMode, name: string): void {
    const lane = this.lane(laneId);
    if (!lane) return;
    const index = tokenId ? this.indexOf(laneId, tokenId) : -1;
    const stone = soundToken(name);
    if (index < 0) lane.tokens.push(stone);
    else if (mode === 'insert') lane.tokens.splice(index, 0, stone);
    else replaceAt(lane.tokens, index, stone);
  }

  /**
   * Klammerpaar anhängen, davor einfügen oder den Stein damit umschliessen.
   * Ein neues Paar enthält eine Pause; in Wertreihen (Effekt, Sampler-Spur) stattdessen einen Wert, denn `~` liesse dort
   * die Klänge ausfallen, und im Klang einer Notenspur bzw. im Sample einer Sampler-Spur aus demselben Grund `sine` bzw. `brk`.
   */
  placePair(laneId: string, tokenId: string | null, mode: PlaceMode, group: GroupType): void {
    const lane = this.lane(laneId);
    if (!lane) return;
    const index = tokenId ? this.indexOf(laneId, tokenId) : -1;
    if (index >= 0 && mode === 'replace') return wrapAt(lane.tokens, index, group);
    const at = index < 0 ? lane.tokens.length : index;
    insertPair(lane.tokens, at, group);
    const inner = lane.tokens[at + 1];
    if (inner.kind !== 'sound') return;
    if (lane.content === 'values') inner.sound = (lane.info && defaultValue(lane.info)) ?? '0';
    else if (lane.effect === lane.track.sample) inner.sound = DEFAULT_SAMPLE;
    else if (lane.effect) inner.sound = DEFAULT_VOICE;
  }

  removeToken(laneId: string, tokenId: string): void {
    const lane = this.lane(laneId);
    const index = this.indexOf(laneId, tokenId);
    if (lane && index >= 0) removeAt(lane.tokens, index);
  }

  /** Klammer samt Gegenklammer entfernen, der Inhalt bleibt. */
  unwrap(laneId: string, tokenId: string): void {
    const lane = this.lane(laneId);
    const index = this.indexOf(laneId, tokenId);
    if (lane && index >= 0) unwrapAt(lane.tokens, index);
  }

  /** Steine von `fromId` bis `toId` (auch rückwärts) umschliessen. Angeschnittene Klammerpaare kommen ganz hinein. */
  wrapRange(laneId: string, fromId: string, toId: string, group: GroupType): void {
    const lane = this.lane(laneId);
    const from = this.indexOf(laneId, fromId);
    const to = this.indexOf(laneId, toId);
    if (lane && from >= 0 && to >= 0) wrapRange(lane.tokens, from, to, group);
  }

  setGroup(laneId: string, tokenId: string, group: GroupType): void {
    const lane = this.lane(laneId);
    const index = this.indexOf(laneId, tokenId);
    if (lane && index >= 0) setGroup(lane.tokens, index, group);
  }

  /**
   * Stein aus der Palette auf einen Stein fallen lassen: ein Klang ersetzt ihn (Zufall und Wiederholung bleiben).
   * Nur Klänge und rohe Steine lassen sich so ersetzen, sonst wird davor eingefügt.
   */
  replaceWithItem(laneId: string, index: number, item: PaletteItem): void {
    const lane = this.lane(laneId);
    const old = lane?.tokens[index];
    if (!lane || lane.content === 'values' || !old) return;
    if (old.kind !== 'sound' && old.kind !== 'raw') return this.insertItem(laneId, index, item);
    replaceAt(lane.tokens, index, soundToken(item.name));
  }

  /** Stein aus der Palette einsetzen. Nur in Klang- und Notenreihen; `index` null = ans Ende. */
  insertItem(laneId: string, index: number | null, item: PaletteItem): void {
    const lane = this.lane(laneId);
    if (!lane || lane.content === 'values') return;
    const at = index === null ? lane.tokens.length : Math.max(0, Math.min(index, lane.tokens.length));
    lane.tokens.splice(at, 0, soundToken(item.name));
  }

  /** Note ans Ende einer Notenreihe hängen: wie die letzte Note, sonst c. Gibt die ID des neuen Steins zurück. */
  appendNote(laneId: string): string | null {
    const lane = this.lane(laneId);
    if (!lane || lane.content !== 'notes') return null;
    const last = [...lane.tokens].reverse().find((t) => t.kind === 'sound' && t.sound !== PAUSE);
    const token = soundToken(last?.kind === 'sound' ? last.sound : FIRST_NOTE);
    lane.tokens.push(token);
    return token.id;
  }

  /** Wert ans Ende einer Effektreihe hängen: wie der letzte Wert, sonst Strudels Vorgabe. Gibt die ID zurück. */
  appendValue(laneId: string): string | null {
    const lane = this.lane(laneId);
    if (!lane || lane.content !== 'values') return null;
    const last = [...lane.tokens].reverse().find((t) => t.kind === 'sound' && t.sound !== PAUSE);
    const token = soundToken(last?.kind === 'sound' ? last.sound : ((lane.info && defaultValue(lane.info)) ?? '0'));
    lane.tokens.push(token);
    return token.id;
  }

  /** Wert eines Wertsteins direkt setzen. Der Stein behält ID, Zufall und Wiederholung. */
  setValue(laneId: string, tokenId: string, value: string): void {
    const t = this.lane(laneId)?.tokens.find((x) => x.id === tokenId);
    if (t?.kind === 'sound') t.sound = value;
  }

  /** Verschieben, auch in eine andere Reihe derselben Art (Klänge zu Klängen, Noten zu Noten, Werte zu Werten). */
  move(fromLaneId: string, tokenId: string, toLaneId: string, toIndex: number): void {
    const from = this.lane(fromLaneId);
    const to = this.lane(toLaneId);
    const fromIndex = this.indexOf(fromLaneId, tokenId);
    if (!from || !to || fromIndex < 0) return;
    if (from.content !== to.content) return;
    moveToken(from.tokens, fromIndex, to.tokens, toIndex);
  }

  // Standardwerte beim Einschalten der Drehknöpfe
  readonly defaults = { star: DEFAULT_STAR, bang: DEFAULT_BANG, random: DEFAULT_RANDOM };
}

export const project = new Project();
