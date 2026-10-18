import { parse as krillParse } from '@strudel/mini/krill-parser.js';
import { PAUSE, closeToken, openToken, rawToken, soundToken } from '../domain/types.ts';
import type { GroupType, Modifiers, SoundToken, Token } from '../domain/types.ts';

/**
 * Mini-Notation (der Text in `s("…")`) zu Steinen. Den Text versteht Strudels eigene Grammatik,
 * wir übersetzen nur ihren Syntaxbaum. Was sich nicht genau als Stein darstellen lässt, wird ein roher Stein
 * mit dem Originaltext. So bedeutet der Code nach dem Umweg über die Steine dasselbe wie vorher.
 */
export type TextResult = { ok: true; tokens: Token[] } | { ok: false; offset: number; message: string };

// Nur die Teile des Syntaxbaums, die wir lesen
interface Loc {
  start: { offset: number };
  end: { offset: number };
}
interface Atom {
  type_: 'atom';
  source_: string;
}
interface Pattern {
  type_: 'pattern';
  arguments_: { alignment: string; stepsPerCycle?: unknown };
  source_: (Element | Pattern)[];
}
interface Op {
  type_: string;
  arguments_: { amount?: unknown; type?: string; element?: unknown };
}
interface Element {
  type_: 'element';
  source_: Atom | Pattern;
  options_: { ops: Op[]; weight: number; reps: number };
  location_: Loc;
}

export function textToTokens(text: string): TextResult {
  if (text.trim() === '') return { ok: true, tokens: [] };
  let root: Pattern;
  try {
    root = krillParse(`"${text}"`) as Pattern;
  } catch (e) {
    const err = e as { message?: string; location?: { start?: { offset?: number } } };
    // Die Grammatik erwartet den Text in Anführungszeichen, daher -1
    return { ok: false, offset: Math.max(0, (err.location?.start?.offset ?? 1) - 1), message: err.message ?? 'Syntaxfehler' };
  }
  // Ganze Spur z. B. `a, b` oder `a . b`: ein einziger roher Stein
  if (root.arguments_.alignment !== 'fastcat') return { ok: true, tokens: [rawToken(text.trim())] };
  const tokens: Token[] = [];
  for (const el of root.source_) convert(el as Element, text, tokens);
  return { ok: true, tokens };
}

function convert(el: Element, text: string, out: Token[]): void {
  // Positionen beziehen sich auf den Text mit Anführungszeichen
  const raw = (): void => {
    out.push(rawToken(text.slice(el.location_.start.offset - 1, el.location_.end.offset - 1).trim()));
  };
  const mods = modifiers(el);
  if (!mods) return raw();
  const src = el.source_;
  const stack = stackContent(src);
  if (stack && mods.random === null && mods.repeat === null) {
    for (const member of stack) convert(member, text, out);
    // Jeder Teil ist ein einzelner Klang (sonst null), also genau ein Stein pro Teil
    for (let i = out.length - stack.length + 1; i < out.length; i += 1) (out[i] as SoundToken).joined = true;
    return;
  }
  if (src.type_ === 'atom') {
    if (src.source_ === PAUSE && (mods.random !== null || mods.repeat !== null)) return raw();
    out.push(soundToken(atomText(el), mods));
    return;
  }
  const inner = groupContent(src);
  if (!inner) return raw();
  // `}` trägt nur den Modulowert, keine weiteren Modifier
  if (inner.group === '{' && (mods.random !== null || mods.repeat !== null)) return raw();
  out.push(openToken(inner.group));
  for (const child of inner.elements) convert(child, text, out);
  out.push(closeToken(inner.group, { ...mods, steps: inner.steps }));
}

/**
 * `[a, b*2?]` ist ein stack aus Folgen mit je einem Element. Als Stapel aus Klangsteinen (`SoundToken.joined`) nur, wenn jedes
 * Element ein einzelner Klang mit Modifiern ist, die ein Stein tragen kann. Sonst null (dann roher Stein).
 */
function stackContent(src: Atom | Pattern): Element[] | null {
  if (src.type_ !== 'pattern' || src.arguments_.alignment !== 'stack') return null;
  const members: Element[] = [];
  for (const seq of src.source_) {
    if (seq.type_ !== 'pattern' || seq.arguments_.alignment !== 'fastcat' || seq.source_.length !== 1) return null;
    const el = seq.source_[0] as Element;
    const mods = modifiers(el);
    if (el.source_.type_ !== 'atom' || !mods) return null;
    if (el.source_.source_ === PAUSE && (mods.random !== null || mods.repeat !== null)) return null;
    members.push(el);
  }
  return members.length > 1 ? members : null;
}

/**
 * `[a b]` ist eine fastcat-Folge, `<a b>` eine polymeter_slowcat und `{a b}%4` ein polymeter mit genau einer Folge darin.
 * Alles andere (Kommas, Modulo als Muster): null.
 */
function groupContent(p: Pattern): { group: GroupType; elements: Element[]; steps: number | null } | null {
  const { alignment, stepsPerCycle } = p.arguments_;
  if (alignment === 'fastcat') return { group: '[', elements: p.source_ as Element[], steps: null };
  if ((alignment === 'polymeter_slowcat' || alignment === 'polymeter') && p.source_.length === 1) {
    const seq = p.source_[0] as Pattern;
    if (seq.type_ !== 'pattern' || seq.arguments_.alignment !== 'fastcat') return null;
    const elements = seq.source_ as Element[];
    if (alignment === 'polymeter_slowcat') return { group: '<', elements, steps: null };
    if (stepsPerCycle == null) return { group: '{', elements, steps: null };
    if (isNumberAtom(stepsPerCycle)) return { group: '{', elements, steps: Number(stepsPerCycle.source_) };
  }
  return null;
}

/**
 * Doppelpunkte direkt am Wort (`bd:3`, `.5:2`) liest Strudel als `tail`. Sie gehören zum Text des Steins, wenn jeder Teil ein
 * einzelnes Wort ist und sie vor allen anderen Modifiern stehen. Die Pause trägt keine.
 */
function tails(el: Element): string[] {
  const parts: string[] = [];
  for (const op of el.options_.ops) {
    const tail = op.arguments_.element as Atom | undefined;
    if (op.type_ !== 'tail' || tail?.type_ !== 'atom') break;
    parts.push(tail.source_);
  }
  return parts;
}

/** Text eines Wortes samt seinen Doppelpunkten (`bd:3`). */
function atomText(el: Element): string {
  return [(el.source_ as Atom).source_, ...tails(el)].join(':');
}

/**
 * Höchstens eine Wiederholung (`*n`, `!n` oder Gewicht `@n`), danach höchstens ein Zufall (`?`, `?0.3`), wie `codegen` sie schreibt.
 * Davor dürfen an einem Wort Doppelpunkte stehen (`bd:3*2`, siehe `tails`).
 * `/`, Doppelpunkte an Klammern oder mit Mustern, Euklid, Muster als Zahl oder mehrere Wiederholungen zusammen ergeben null (roher Stein).
 * `a _` ist in Strudel dasselbe wie `a@2` und wird so übernommen.
 */
function modifiers(el: Element): Modifiers | null {
  const { weight, reps } = el.options_;
  const atom = el.source_.type_ === 'atom' && el.source_.source_ !== PAUSE;
  const ops = el.options_.ops.slice(atom ? tails(el).length : 0);
  const result: Modifiers = { random: null, repeat: null };
  // `!` setzt das Gewicht selbst auf die Anzahl Kopien; nur ein Gewicht ohne `!` ist ein `@`
  if (weight !== reps) {
    if (reps !== 1) return null;
    result.repeat = { op: '@', value: weight };
  }
  for (const op of ops) {
    if (result.random !== null) return null;
    const amount = op.arguments_.amount;
    if (op.type_ === 'degradeBy' && (amount === null || typeof amount === 'number')) {
      result.random = amount ?? 0.5;
    } else if (result.repeat !== null) {
      return null;
    } else if (op.type_ === 'replicate' && typeof amount === 'number') {
      result.repeat = { op: '!', value: amount };
    } else if (op.type_ === 'stretch' && op.arguments_.type === 'fast' && isNumberAtom(amount)) {
      result.repeat = { op: '*', value: Number(amount.source_) };
    } else {
      return null;
    }
  }
  return result;
}

function isNumberAtom(x: unknown): x is Atom {
  const a = x as Atom | null;
  return a?.type_ === 'atom' && /^\d+(\.\d+)?$/.test(a.source_) && Number(a.source_) > 0;
}
