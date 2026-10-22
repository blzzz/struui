/**
 * Domänenmodell: Eine Spur ist eine flache Liste von Steinen (Tokens),
 * genau wie der Mini-Notation-Text, den Strudel daraus macht.
 * Dieses Modul hat keine Abhängigkeit zu DOM, Svelte oder Audio.
 */

import type { Effect } from './effects.ts';
import { DEFAULT_VOICE } from './notes.ts';
import { DEFAULT_SAMPLE, DEFAULT_SLICES } from './sampler.ts';
import type { SamplerMode } from './sampler.ts';

/**
 * `[` = Gruppe (teilt sich einen Schritt), `<` = Wechsel (pro Zyklus ein Element),
 * `{` = Polymeter (läuft mit eigener Schrittzahl pro Zyklus, `{a b c}%4`).
 */
export type GroupType = '[' | '<' | '{';

export const CLOSING: Record<GroupType, string> = { '[': ']', '<': '>', '{': '}' };

/** `*` = schneller/langsamer im selben Schritt, `!` = Kopien mit eigenem Schritt, `@` = Gewicht (Schritt wird länger/kürzer). */
export interface Repeat {
  op: '*' | '!' | '@';
  value: number;
}

export interface Modifiers {
  /** Wahrscheinlichkeit, dass der Schritt AUSFÄLLT (Strudel: `?0.3`). null = immer spielen. */
  random: number | null;
  /** null = keine Wiederholung. */
  repeat: Repeat | null;
}

export interface SoundToken extends Modifiers {
  id: string;
  kind: 'sound';
  /** Sample-/Synth-Name oder `~` für eine Pause. */
  sound: string;
  /**
   * Hängt mit Komma am Klangstein davor: beide klingen gleichzeitig (`[bd, hh]`). Aufeinanderfolgende verbundene Steine
   * bilden einen Stapel. Gilt nur direkt nach einem Klangstein (`joinsPrevious`).
   */
  joined?: boolean;
}

export interface OpenToken {
  id: string;
  kind: 'open';
  group: GroupType;
}

/**
 * Modifier einer Gruppe hängen, wie im Code, an der schliessenden Klammer.
 * `}` trägt statt Zufall und Wiederholung nur den Modulowert (`steps`). Die übrigen Werte bleiben gespeichert,
 * werden bei `{` aber nicht ausgegeben, so kommen sie beim Zurückwechseln auf `[` oder `<` wieder.
 */
export interface CloseToken extends Modifiers {
  id: string;
  kind: 'close';
  group: GroupType;
  /** Nur bei `}`: Schritte pro Zyklus (`%4`). null = so viele wie Elemente. */
  steps: number | null;
}

/**
 * Roher Stein: Mini-Notation, für die es (noch) keinen eigenen Stein gibt, z. B. `bd(3,8)`, `bd:3`, `a@3`, `[a, b]`.
 * Entsteht beim Bearbeiten des Codes und wird unverändert wieder ausgegeben.
 */
export interface RawToken {
  id: string;
  kind: 'raw';
  text: string;
}

export type Token = SoundToken | OpenToken | CloseToken | RawToken;

/**
 * `sound`: Klänge im Browser (`s("bd sd")`). `note`: Noten im Browser, gespielt mit einem Klang (`note("f d").s("sine")`).
 * `midi`: Klänge plus `.note()` an ein MIDI-Gerät (`.midi()`).
 * `sampler`: Stellen in einem Sample (`s("brk").slice(8, "0 3")` oder `s("brk").scrub("0 .5")`, siehe `sampler.ts`).
 */
export type TrackType = 'sound' | 'note' | 'midi' | 'sampler';

/** Was auf den Steinen einer Reihe liegt: Klänge, Noten oder Werte (Effekte, Sampler-Spur). */
export type TrackContent = 'sounds' | 'notes' | 'values';

/** Was auf den Steinen der Spur liegt. Klang- und MIDI-Spuren teilen ihre Klangsteine. */
export function contentOf(type: TrackType): TrackContent {
  return type === 'note' ? 'notes' : type === 'sampler' ? 'values' : 'sounds';
}

export interface Track {
  id: string;
  type: TrackType;
  /** Name der Spur, im Code als Kommentar davor (`/* drums *\/ s("bd")`). Leer = kein Kommentar. Nur Buchstaben, Ziffern und `_` (siehe `trackName`). */
  name: string;
  /** Klangsteine, bei Notenspuren Notensteine, bei Sampler-Spuren Wertsteine (Positionen oder Abschnitte). */
  tokens: Token[];
  /** Die Steine der anderen Inhaltsarten, damit sie beim Zurückwechseln wieder da sind. */
  parked: Partial<Record<TrackContent, Token[]>>;
  /** Notenspur: Rechenarten auf den Noten, in dieser Reihenfolge (`note("c e".add("<0 3>").div(2))`). Sonst gespeichert, nicht im Code. */
  noteOps: Effect[];
  /** Notenspur: womit die Noten klingen, als Wertreihe mit Klangnamen (`.s("sine")`). Bei anderen Spuren gespeichert, aber nicht im Code. */
  voice: Effect;
  /** Sampler-Spur: das Sample als Reihe mit Klangnamen (`s("brk")`). Bei anderen Spuren gespeichert, aber nicht im Code. */
  sample: Effect;
  /** Sampler-Spur: wie die Wertsteine das Sample spielen (`scrub` oder `slice`). */
  samplerMode: SamplerMode;
  /** Sampler-Spur mit `slice`: in so viele gleich lange Abschnitte wird das Sample geteilt (`.slice(8, "…")`). */
  slices: number;
  /** Effekte der ganzen Spur, in dieser Reihenfolge an den Code gehängt (`.lpf(800).room(0.5)`). */
  effects: Effect[];
  /** Stumm geschaltet: steht weiter im Code, Strudel spielt sie aber nicht (`.hush()` am Ende). */
  muted: boolean;
  /** Lautstärke der Spur nach allen Effekten (`.postgain()`), 1 = unverändert und nicht im Code. Nicht bei MIDI-Spuren. */
  volume: number;
  /** Klang- und Notenspur: Strudels Orbit (1–8), Spuren im selben Orbit teilen Hall und Delay. 1 = Standard, nicht im Code. */
  orbit: number;
  /** MIDI-Spur: Kanal 1–16 (`.midichan()`), steht immer im Code. */
  channel: number;
  /** MIDI-Spur: Name des Ausgangs (`.midi('IAC Driver Bus 1')`). Leer = Strudel wählt (erster IAC-Port, sonst der erste). */
  port: string;
  /**
   * Roher Code: ein Ausdruck, den Strudel-Steine nicht als Spur versteht (`n("0 2").scale("C:minor")`, `arrange(…)`).
   * Steht unverändert im Stapel, nur Name (Kommentar davor) und Stummschaltung (`.hush()`) kommen dazu. null = gewöhnliche Spur;
   * die übrigen Felder bleiben dann gespeichert, gelten aber nicht.
   */
  code: string | null;
}

export const PAUSE = '~';

/** Bereich des Lautstärkereglers einer Spur. Über 1 wird lauter. */
export const VOLUME_MAX = 1.5;

/** Orbits und MIDI-Kanäle zählen ab 1; Tippen erhöht und springt nach dem höchsten Wert auf 1 zurück. */
export const ORBIT_MAX = 8;
export const CHANNEL_MAX = 16;

/** Nächste Nummer im Kreis 1…max. */
export function nextInCycle(value: number, max: number): number {
  return value >= max || value < 1 ? 1 : Math.floor(value) + 1;
}

let counter = 0;
/** Einfache, stabile IDs. Offene Frage: bei Persistenz/Kamera evtl. durch UUIDs ersetzen. */
export function newId(prefix = 't'): string {
  counter += 1;
  return `${prefix}${counter}`;
}

const noMods = (): Modifiers => ({ random: null, repeat: null });

export function soundToken(sound: string, mods: Partial<Modifiers> & { joined?: boolean } = {}): SoundToken {
  return { id: newId(), kind: 'sound', sound, ...noMods(), ...mods };
}
export function openToken(group: GroupType): OpenToken {
  return { id: newId(), kind: 'open', group };
}
export function closeToken(group: GroupType, mods: Partial<Modifiers> & { steps?: number | null } = {}): CloseToken {
  return { id: newId(), kind: 'close', group, steps: null, ...noMods(), ...mods };
}
export function effect(name: string, tokens: Token[] = []): Effect {
  return { id: newId('e'), name, tokens };
}
export function rawToken(text: string): RawToken {
  return { id: newId(), kind: 'raw', text };
}
export function track(tokens: Token[] = [], name = ''): Track {
  return {
    id: newId('s'),
    type: 'sound',
    name,
    tokens,
    parked: {},
    noteOps: [],
    voice: effect('s', [soundToken(DEFAULT_VOICE)]),
    sample: effect('s', [soundToken(DEFAULT_SAMPLE)]),
    samplerMode: 'slice',
    slices: DEFAULT_SLICES,
    effects: [],
    muted: false,
    volume: 1,
    orbit: 1,
    channel: 1,
    port: '',
    code: null,
  };
}

/**
 * Bereinigt einen Spurnamen: nur Buchstaben, Ziffern und `_`, kein `_` am Ende.
 * So kann der Name den Kommentar im Code (`/* drums *\/`) nie beenden.
 */
export function trackName(raw: string): string {
  return raw.replace(/[^\p{L}\p{Nd}_]/gu, '').replace(/_+$/, '');
}

/** Wort für den Standardnamen je Art (`Klangspur_1`). Nur Zeichen, die `trackName` stehen lässt. */
const TYPE_NAMES: Record<TrackType, string> = {
  sound: 'Klangspur',
  note: 'Notenspur',
  midi: 'MIDIspur',
  sampler: 'Samplerspur',
};

/** Name für eine Spur ohne Namen: ihre Art mit der ersten freien Nummer (`Klangspur_1`, `Klangspur_2` …). */
export function defaultTrackName(type: TrackType, taken: Iterable<string>): string {
  const names = new Set(taken);
  let n = 1;
  while (names.has(`${TYPE_NAMES[type]}_${n}`)) n += 1;
  return `${TYPE_NAMES[type]}_${n}`;
}

/**
 * `name`, wenn ihn keine andere Spur trägt, sonst mit der ersten freien Nummer (`drums_2`; `Klangspur_1` wird `Klangspur_2`).
 * Namen müssen eindeutig sein: die Lage auf der Arbeitsfläche steht im Code unter dem Namen (`boardComment`).
 */
export function uniqueName(name: string, taken: Iterable<string>): string {
  const names = new Set(taken);
  if (!names.has(name)) return name;
  const base = name.replace(/_\d+$/, '');
  let n = 2;
  while (names.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

export const isPause = (t: Token): boolean => t.kind === 'sound' && t.sound === PAUSE;

/** Liegt der Stein an `index` mit Komma im selben Stapel wie der Stein davor (`[bd, hh]`)? Nur Klangsteine stapeln sich. */
export function joinsPrevious(tokens: readonly Token[], index: number): boolean {
  const t = tokens[index];
  return t?.kind === 'sound' && !!t.joined && tokens[index - 1]?.kind === 'sound';
}

/** Nur Klänge (ausser Pause) und schliessende Klammern (ausser `}`) tragen Zufall und Wiederholung. */
export function hasModifiers(t: Token): t is SoundToken | CloseToken {
  return (t.kind === 'sound' && t.sound !== PAUSE) || (t.kind === 'close' && t.group !== '{');
}

/** `}` trägt den Modulowert. */
export function hasSteps(t: Token): t is CloseToken {
  return t.kind === 'close' && t.group === '{';
}

export function label(t: Token): string {
  if (t.kind === 'sound') return t.sound;
  if (t.kind === 'raw') return t.text;
  if (t.kind === 'open') return t.group;
  return CLOSING[t.group];
}
