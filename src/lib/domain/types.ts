/**
 * Domänenmodell: Eine Spur ist eine flache Liste von Steinen (Tokens),
 * genau wie der Mini-Notation-Text, den Strudel daraus macht.
 * Dieses Modul hat keine Abhängigkeit zu DOM, Svelte oder Audio.
 */

import type { Effect } from './effects.ts';
import { DEFAULT_VOICE } from './notes.ts';

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
 */
export type TrackType = 'sound' | 'note' | 'midi';

/** Was auf den Steinen der Spur liegt. Klang- und MIDI-Spuren teilen ihre Klangsteine. */
export function contentOf(type: TrackType): 'sounds' | 'notes' {
  return type === 'note' ? 'notes' : 'sounds';
}

export interface Track {
  id: string;
  type: TrackType;
  /** Name der Spur, im Code nach dem `$` (`$drums:`). Leer = `$:`. Nur Buchstaben, Ziffern und `_` (siehe `trackName`). */
  name: string;
  /** Klangsteine, bei Notenspuren Notensteine. */
  tokens: Token[];
  /** Die Steine der anderen Inhaltsart (Noten bzw. Klänge), damit sie beim Zurückwechseln wieder da sind. */
  parked: Token[];
  /** Notenspur: Rechenarten auf den Noten, in dieser Reihenfolge (`note("c e".add("<0 3>").div(2))`). Sonst gespeichert, nicht im Code. */
  noteOps: Effect[];
  /** Notenspur: womit die Noten klingen, als Wertreihe mit Klangnamen (`.s("sine")`). Bei anderen Spuren gespeichert, aber nicht im Code. */
  voice: Effect;
  /** Effekte der ganzen Spur, in dieser Reihenfolge an den Code gehängt (`.lpf(800).room(0.5)`). */
  effects: Effect[];
  /** Stumm geschaltet: steht weiter im Code, Strudel spielt sie aber nicht (`_$:`). */
  muted: boolean;
  /** Lautstärke der Spur nach allen Effekten (`.postgain()`), 1 = unverändert und nicht im Code. Nicht bei MIDI-Spuren. */
  volume: number;
  /** Klang- und Notenspur: Strudels Orbit (1–8), Spuren im selben Orbit teilen Hall und Delay. 1 = Standard, nicht im Code. */
  orbit: number;
  /** MIDI-Spur: Kanal 1–16 (`.midichan()`), steht immer im Code. */
  channel: number;
  /** MIDI-Spur: Name des Ausgangs (`.midi('IAC Driver Bus 1')`). Leer = Strudel wählt (erster IAC-Port, sonst der erste). */
  port: string;
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

export function soundToken(sound: string, mods: Partial<Modifiers> = {}): SoundToken {
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
    parked: [],
    noteOps: [],
    voice: effect('s', [soundToken(DEFAULT_VOICE)]),
    effects: [],
    muted: false,
    volume: 1,
    orbit: 1,
    channel: 1,
    port: '',
  };
}

/**
 * Bereinigt einen Spurnamen: nur Zeichen, die in einem JavaScript-Namen erlaubt sind.
 * Kein `_` am Ende, das würde die Spur in Strudel stumm schalten (`drums_:`).
 */
export function trackName(raw: string): string {
  return raw.replace(/[^\p{L}\p{Nd}_]/gu, '').replace(/_+$/, '');
}

export const isPause = (t: Token): boolean => t.kind === 'sound' && t.sound === PAUSE;

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
