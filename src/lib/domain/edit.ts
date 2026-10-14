import { QUICK_SOUNDS } from './sounds.ts';
import { PAUSE, closeToken, hasModifiers, openToken, soundToken } from './types.ts';
import type { GroupType, Token } from './types.ts';

/** Reine Bearbeitungs-Funktionen auf einer Steinliste. Sie verändern das übergebene Array. */

/**
 * Klammerpaar an Position `index` einfügen. Strudel lehnt leere Klammern ab, deshalb liegt eine Pause darin.
 * So bleibt die Spur gültig und läuft weiter, bis die Nutzerin den Inhalt austauscht.
 */
export function insertPair(tokens: Token[], index: number, group: GroupType): void {
  tokens.splice(index, 0, openToken(group), soundToken(PAUSE), closeToken(group));
}

/** Stein an Position `index` mit einem Klammerpaar umschliessen. */
export function wrapAt(tokens: Token[], index: number, group: GroupType): void {
  tokens.splice(index + 1, 0, closeToken(group));
  tokens.splice(index, 0, openToken(group));
}

/**
 * Bereich zwischen zwei Steinen (Reihenfolge egal), so erweitert, dass jede Klammer darin ihre Gegenklammer mitnimmt.
 * Ein Klammerpaar um diesen Bereich lässt die Reihe deshalb ausgeglichen. Klammern ohne Gegenstück bleiben aussen vor.
 */
export function wrapSpan(tokens: readonly Token[], from: number, to: number): [number, number] {
  let lo = Math.min(from, to);
  let hi = Math.max(from, to);
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = lo; i <= hi; i++) {
      const p = partnerIndex(tokens, i);
      if (p < 0) continue;
      if (p < lo) [lo, changed] = [p, true];
      if (p > hi) [hi, changed] = [p, true];
    }
  }
  return [lo, hi];
}

/** Steine von `from` bis `to` (auch rückwärts) mit einem Klammerpaar umschliessen, siehe `wrapSpan`. */
export function wrapRange(tokens: Token[], from: number, to: number, group: GroupType): void {
  const [lo, hi] = wrapSpan(tokens, from, to);
  tokens.splice(hi + 1, 0, closeToken(group));
  tokens.splice(lo, 0, openToken(group));
}

export function removeAt(tokens: Token[], index: number): void {
  tokens.splice(index, 1);
}

/** Ersetzt einen Stein. Zufall und Wiederholung bleiben erhalten, wenn beide Steine welche tragen. */
export function replaceAt(tokens: Token[], index: number, next: Token): void {
  const old = tokens[index];
  if (hasModifiers(old) && hasModifiers(next)) {
    next.random = old.random;
    next.repeat = old.repeat ? { ...old.repeat } : null;
  }
  tokens[index] = next;
}

/** Verschiebt einen Stein, auch in eine andere Liste. `toIndex` ist die Einfügeposition vor dem Entfernen. */
export function moveToken(from: Token[], fromIndex: number, to: Token[], toIndex: number): void {
  const [token] = from.splice(fromIndex, 1);
  let index = toIndex;
  if (from === to && fromIndex < index) index -= 1;
  to.splice(Math.max(0, index), 0, token);
}

/**
 * Index der Gegenklammer zu der Klammer an `index`, oder -1. Gezählt wird über alle Klammerarten,
 * so findet sich das Gegenstück auch, wenn die Arten gerade nicht zusammenpassen.
 */
export function partnerIndex(tokens: readonly Token[], index: number): number {
  const token = tokens[index];
  if (token.kind !== 'open' && token.kind !== 'close') return -1;
  const step = token.kind === 'open' ? 1 : -1;
  let level = 0;
  for (let i = index + step; i >= 0 && i < tokens.length; i += step) {
    const t = tokens[i];
    if (t.kind === token.kind) level += 1;
    else if (t.kind === 'open' || t.kind === 'close') {
      if (level === 0) return i;
      level -= 1;
    }
  }
  return -1;
}

/** Klammer an `index` samt Gegenklammer entfernen, der Inhalt bleibt. Ohne Gegenklammer geht nur diese Klammer weg. */
export function unwrapAt(tokens: Token[], index: number): void {
  const partner = partnerIndex(tokens, index);
  for (const i of [index, partner].filter((i) => i >= 0).sort((a, b) => b - a)) tokens.splice(i, 1);
}

/** Klammerart einer Klammer und ihrer Gegenklammer setzen. */
export function setGroup(tokens: Token[], index: number, group: GroupType): void {
  for (const i of [index, partnerIndex(tokens, index)]) {
    const t = tokens[i];
    if (t && (t.kind === 'open' || t.kind === 'close')) t.group = group;
  }
}

const NEXT_GROUP: Record<GroupType, GroupType> = { '[': '<', '<': '{', '{': '[' };

/**
 * Einzeltippen: Klang weiterschalten, bei Klammern `[` → `<` → `{` → `[` (die Gegenklammer wechselt mit).
 * `cycle`: wodurch geschaltet wird, bei Effekten die Werte. Ein Stein, der nicht darin vorkommt, springt auf den ersten.
 */
export function quickSwitch(tokens: Token[], index: number, cycle: readonly string[] = QUICK_SOUNDS): void {
  const token = tokens[index];
  if (token.kind === 'sound') {
    if (cycle.length === 0) return;
    const i = cycle.indexOf(token.sound);
    token.sound = cycle[(i + 1) % cycle.length];
    return;
  }
  if (token.kind === 'raw') return;
  const group = NEXT_GROUP[token.group];
  token.group = group;
  const partner = tokens[partnerIndex(tokens, index)];
  if (partner && (partner.kind === 'open' || partner.kind === 'close')) partner.group = group;
}

/**
 * Nach dem Bearbeiten des Codes: Steine an gleicher Stelle und gleicher Art behalten ihre ID.
 * So bleiben Svelte-Schlüssel und das Aufleuchten stabil, während man tippt.
 */
export function adoptIds(old: readonly Token[], next: Token[]): void {
  next.forEach((t, i) => {
    if (old[i]?.kind === t.kind) t.id = old[i].id;
  });
}
