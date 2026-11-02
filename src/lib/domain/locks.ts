/**
 * Paramlocks einer Klangspur, wie bei Elektron: eine Reihe Wertsteine, jeder Wert besteht aus Teilen, je Parameter einer
 * (`1:4:sd` zu `velocity:n:s`). Im Code nach den Effekten: `.up("1 .5 ~ .7:4:sd".as("velocity:n:s"))`.
 * `up` (siehe `audio/up.ts`) überschreibt nur die Parameter, die ein Stein setzt, und gibt den Rhythmus vor:
 * eine Pause lässt den Schritt aus (wie `struct`).
 *
 * Strudel kennt keinen leeren Teil mitten im Wert (`~:4` macht den ganzen Schritt still). Leer bleiben dürfen nur die
 * hinteren Teile (`1:4` lässt `s` stehen). Wer einen hinteren Teil setzt, füllt die leeren davor mit Startwerten.
 */

import { EFFECTS, categoryOf, defaultValue, effectInfo, isValueAtom, search } from './effects.ts';
import type { Effect, EffectCategory, EffectInfo } from './effects.ts';
import { PAUSE, newId } from './types.ts';
import type { Token } from './types.ts';

export interface Locks extends Effect {
  /** Die Parameter, in der Reihenfolge der Teile (`as("velocity:n:s")`). Leer: die Spur hat keine Paramlocks (noch nicht gewählt). */
  params: string[];
}

/** Name des Musterbefehls im Code. */
export const LOCKS = 'up';

/** Neue Spuren haben keine Paramlocks; der erste gewählte Parameter schaltet sie ein. */
export function locks(params: string[] = [], tokens: Token[] = []): Locks {
  return { id: newId('e'), name: LOCKS, params: [...params], tokens };
}

/** Variante (`n`) und Klang (`s`) sind keine Effekte, lassen sich aber auch sperren. */
const OWN: Record<string, { values: string[]; start: string; description: string }> = {
  n: { values: ['0', '1', '2', '3', '4'], start: '0', description: 'Variante des Klangs (bd:3)' },
  s: { values: [], start: 'bd', description: 'Klang' },
};

/** Lässt sich der Parameter sperren? Variante, Klang und Effekte, die einen Wert setzen (keine Musterbefehle). */
export function isLockParam(name: string): boolean {
  if (name in OWN) return true;
  const info = effectInfo(name);
  return !!info && !info.noValue && (info.group === 'audio' || info.group === 'pitch');
}

/** Alle sperrbaren Parameter: zuerst Variante und Klang, dann die Effekte nach Namen. */
export function lockParams(): string[] {
  const fx = EFFECTS.filter((e) => isLockParam(e.name)).map((e) => e.name);
  return [...Object.keys(OWN), ...[...new Set(fx)].sort((a, b) => a.localeCompare(b))];
}

/** Ein sperrbarer Parameter als Eintrag der Effektsuche. Variante und Klang stehen unter `sample`. */
export function lockInfo(name: string): EffectInfo {
  const own = OWN[name];
  if (own) return { name, group: 'sample', synonyms: [], description: own.description, hint: '', values: own.values };
  return effectInfo(name) ?? { name, group: 'audio', synonyms: [], description: '', hint: '', values: [] };
}

/**
 * Sperrbare Parameter für die Effektsuche, ohne `exclude` (die schon gesperrten), einer Kategorie (null = alle),
 * gesucht wie Effekte. Ohne Suchtext in der Reihenfolge von `lockParams`.
 */
export function browseLockParams(query: string, category: EffectCategory | null, exclude: readonly string[] = []): EffectInfo[] {
  const offered = lockParams()
    .filter((p) => !exclude.includes(p))
    .map(lockInfo)
    .filter((info) => category === null || categoryOf(info) === category);
  return search(offered, query, Infinity);
}

/** Kurze Beschreibung für die Auswahl. */
export function lockDescription(name: string): string {
  return OWN[name]?.description ?? effectInfo(name)?.description ?? '';
}

/** Beispielwerte des Parameters (für −/+). */
export function lockValues(name: string): readonly string[] {
  return OWN[name]?.values ?? effectInfo(name)?.values ?? [];
}

/** Startwert eines Teils: Strudels Vorgabe des Parameters, sonst 0. */
export function lockDefault(name: string): string {
  if (OWN[name]) return OWN[name].start;
  const info = effectInfo(name);
  return (info && defaultValue(info)) ?? '0';
}

/** Teile eines Werts, je Parameter einer; fehlende sind leer. */
export function lockParts(value: string, count: number): string[] {
  const parts = value.split(':');
  return Array.from({ length: Math.max(count, parts.length) }, (_, i) => parts[i] ?? '');
}

/** Stelle des letzten nicht leeren Teils, -1 ohne. */
function lastFilled(parts: readonly string[]): number {
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i] !== '') return i;
  return -1;
}

/** Teile wieder zu einem Wert. Leere Teile am Ende fallen weg. null, wenn alle leer sind oder ein leerer Teil in der Mitte steht. */
export function joinLockParts(parts: readonly string[]): string | null {
  const end = lastFilled(parts);
  if (end < 0) return null;
  const kept = parts.slice(0, end + 1);
  return kept.includes('') ? null : kept.join(':');
}

/** Ist `text` ein Wert für `count` Parameter: ein bis `count` Teile, jeder ein Wert? Die Pause ist kein Wert. */
export function isLockValue(text: string, count: number): boolean {
  const parts = text.split(':');
  return parts.length <= count && parts.every((p) => isValueAtom(p));
}

/**
 * Teil `index` eines Werts setzen. Leere Teile davor bekommen ihren Startwert, damit der Wert gültig bleibt.
 * Leer gesetzt geht nur hinten (sonst null), alles leer ebenso nicht.
 */
export function setLockPart(value: string, index: number, part: string, params: readonly string[]): string | null {
  const parts = lockParts(value, params.length);
  parts[index] = part;
  if (part !== '') for (let i = 0; i < index; i++) if (parts[i] === '') parts[i] = lockDefault(params[i]);
  return joinLockParts(parts);
}

/** Werte der Reihe ändern, Pausen, Klammern und rohe Steine bleiben. */
function eachValue(tokens: readonly Token[], f: (value: string) => string): Token[] {
  return tokens.map((t) => (t.kind === 'sound' && t.sound !== PAUSE ? { ...t, sound: f(t.sound) } : t));
}

/** Parameter hinten anfügen. Die Werte bleiben, ihr neuer Teil ist leer. */
export function addLockParam(l: Locks, name: string): void {
  l.params = [...l.params, name];
}

/**
 * Parameter `index` entfernen, samt seinem Teil in jedem Wert. Ein Wert, der danach leer ist oder eine Lücke hätte,
 * bekommt Startwerte. Mit dem letzten Parameter gehen auch alle Werte: die Spur hat dann keine Paramlocks mehr.
 */
export function removeLockParam(l: Locks, index: number): void {
  if (index < 0 || index >= l.params.length) return;
  if (l.params.length === 1) {
    l.params = [];
    l.tokens = [];
    return;
  }
  const params = l.params.filter((_, i) => i !== index);
  l.tokens = eachValue(l.tokens, (v) => {
    const parts = lockParts(v, l.params.length).filter((_, i) => i !== index);
    return joinLockParts(parts) ?? fill(parts, params);
  });
  l.params = params;
}

/** Lücken mit Startwerten füllen, leere Teile am Ende bleiben weg. Ganz leer: der Startwert des ersten Parameters. */
function fill(parts: readonly string[], params: readonly string[]): string {
  const end = Math.max(0, lastFilled(parts));
  return parts
    .slice(0, end + 1)
    .map((p, i) => p || lockDefault(params[i]))
    .join(':');
}

/** Parameter `index` durch `name` ersetzen. Die Werte bleiben. */
export function renameLockParam(l: Locks, index: number, name: string): void {
  if (index < 0 || index >= l.params.length) return;
  l.params = l.params.map((p, i) => (i === index ? name : p));
}
