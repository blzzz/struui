import { parse, parseExpressionAt } from 'acorn';
import type { CallExpression, Comment, Expression, Literal, Node, Options, SpreadElement, Statement } from 'acorn';
import { readBoardComment } from '../domain/board.ts';
import type { Spot } from '../domain/board.ts';
import type { Frame } from '../domain/codegen.ts';
import type { TempoUnit } from '../domain/tempo.ts';
import { trackName } from '../domain/types.ts';
import type { TrackType } from '../domain/types.ts';
import { codeToTrack } from './from-code.ts';
import type { CodeLine } from './from-code.ts';

/**
 * Der ganze Code der Code-Ansicht zurück zu Spuren, die Umkehrung von `toStrudelProgram`. Liest beliebigen Strudel-Code:
 * was Strudel-Steine versteht, wird zu Spuren, alles andere bleibt wörtlich stehen. Kein Code geht verloren.
 *
 * - Die Spuren kommen aus den Ausdrücken mit Label (`$: s("bd")`, `drums: s("bd")`, stumm mit `_`), aus jedem Ausdruck, der mit
 *   `stack(…)` beginnt (eine Spur je Eintrag, verschachtelte Stapel ebenso), und aus dem letzten Ausdruck. Alle zusammen ergeben
 *   einen Stapel, auch wenn der Code mehrere hatte.
 * - Ein Eintrag, den `codeToTrack` nicht versteht, wird eine Spur mit rohem Code (`Track.code`).
 * - Tempo (`setcpm(120/4)`, `setcpm(30)`, `setcps(.5)`) und die eigenen Aufnahmen (`samples({ rec1: 'data:audio/…' })`)
 *   erzeugt Strudel-Steine selbst; diese Zeilen werden gelesen bzw. weggelassen.
 * - Der Sammelkommentar mit der Lage der Spuren (`/* board: … *\/`, siehe `boardComment`) wird gelesen und weggelassen.
 * - Alles andere ist der Rahmen (`Frame`): Code davor, Aufrufe direkt am Stapel (`.fast(2)`) und Code danach.
 *
 * Fehler gibt es nur, wenn der Text kein gültiges JavaScript ist.
 */
export type ProgramEntry =
  | { kind: 'track'; line: CodeLine }
  | { kind: 'raw'; name: string; muted: boolean; code: string };

export type ProgramResult =
  | {
      ok: true;
      entries: ProgramEntry[];
      frame: Frame;
      tempo: { cps: number; unit: TempoUnit } | null;
      /** Lage der Spuren nach Namen, null ohne Sammelkommentar. */
      board: Map<string, Spot> | null;
    }
  | { ok: false; offset: number; message: string };

/** Wie Strudels Transpiler (`@strudel/transpiler`): neuestes JavaScript, `await` auf oberster Ebene. */
const OPTIONS: Options = { ecmaVersion: 'latest', sourceType: 'module', allowAwaitOutsideFunction: true };

/** Ein Syntaxfehler von acorn, auf Deutsch eingeleitet. acorn hängt `(Zeile:Spalte)` an, das zeigt die Oberfläche selbst. */
function syntaxError(e: unknown): { ok: false; offset: number; message: string } {
  if (!(e instanceof SyntaxError)) throw e;
  const pos = (e as SyntaxError & { pos?: number }).pos ?? 0;
  return { ok: false, offset: pos, message: `Kein gültiges JavaScript: ${e.message.replace(/\s*\(\d+:\d+\)$/, '')}` };
}

/**
 * Roher Eintrag: Name aus einem Kommentar am Anfang (`/* drums *\/`), stumm mit `.hush()` am Ende. Beides wird abgetrennt,
 * damit Name und Stummschaltung wie bei jeder Spur bedienbar sind; der Rest bleibt unverändert.
 */
export function rawLine(text: string): { name: string; muted: boolean; code: string } {
  let code = text.trim();
  let name = '';
  const comment = /^\/\*([\s\S]*?)\*\/\s*/.exec(code);
  if (comment && isName(comment[1].trim())) {
    name = comment[1].trim();
    code = code.slice(comment[0].length);
  }
  const hush = /\.\s*hush\s*\(\s*\)\s*$/.exec(code);
  if (hush) code = code.slice(0, hush.index).trimEnd();
  return { name, muted: !!hush, code };
}

const isName = (text: string): boolean => text !== '' && trackName(text) === text;

/**
 * Ist `text` genau ein Ausdruck, der als Eintrag in `stack(…)` stehen kann? Für rohen Code, der direkt bearbeitet wird.
 * Danach dürfen nur Leerzeichen und Blockkommentare folgen; ein `// …` am Ende schlösse das Komma dahinter mit ein.
 */
export function checkExpression(text: string): { ok: true } | { ok: false; offset: number; message: string } {
  let node: Expression;
  try {
    node = parseExpressionAt(text, 0, OPTIONS);
  } catch (e) {
    return syntaxError(e);
  }
  if (node.type === 'SequenceExpression') {
    return { ok: false, offset: node.expressions[1].start, message: 'Hier steht mehr als ein Ausdruck (Komma).' };
  }
  const rest = text.slice(node.end);
  if (!/^(\s|\/\*[\s\S]*?\*\/)*$/.test(rest)) {
    return { ok: false, offset: node.end + (rest.length - rest.trimStart().length), message: 'Nach dem Ausdruck darf nichts mehr folgen.' };
  }
  return { ok: true };
}

/** Name einer Spur aus einem Label: `drums` aus `drums:` oder `_drums:` (stumm), leer bei `$:` und `_$:`. */
function labelTrack(label: string): { name: string; muted: boolean } {
  const muted = label.startsWith('_');
  const name = muted ? label.slice(1) : label;
  return { name: name === '$' || !isName(name) ? '' : name, muted };
}

/** Tempo aus `setcps(x)`, `setcpm(x)` und `setcpm(x/4)` (BPM, wie Strudel-Steine es schreibt). Sonst null. */
function tempoOf(s: Statement): { cps: number; unit: TempoUnit } | null {
  if (s.type !== 'ExpressionStatement' || s.expression.type !== 'CallExpression') return null;
  const { callee, arguments: args } = s.expression;
  if (callee.type !== 'Identifier' || args.length !== 1) return null;
  const fn = callee.name.toLowerCase();
  if (fn !== 'setcps' && fn !== 'setcpm') return null;
  const num = (n: Node): number | null => {
    const value = n.type === 'Literal' ? (n as Literal).value : null;
    return typeof value === 'number' ? value : null;
  };
  const [arg] = args;
  let value = num(arg);
  let unit: TempoUnit = fn === 'setcps' ? 'cps' : 'cpm';
  if (value === null && fn === 'setcpm' && arg.type === 'BinaryExpression' && arg.operator === '/') {
    const a = num(arg.left);
    const b = num(arg.right);
    if (a !== null && b) {
      value = a / b;
      if (b === 4) unit = 'bpm';
    }
  }
  if (value === null || !(value > 0)) return null;
  return { cps: fn === 'setcps' ? value : value / 60, unit };
}

/** `samples({ name: 'data:audio/…' })`: die eigenen Aufnahmen, die Strudel-Steine selbst einsetzt (auch gekürzt aus der Anzeige). */
function isRecordings(s: Statement): boolean {
  if (s.type !== 'ExpressionStatement' || s.expression.type !== 'CallExpression') return false;
  const { callee, arguments: args } = s.expression;
  if (callee.type !== 'Identifier' || callee.name !== 'samples' || args.length !== 1 || args[0].type !== 'ObjectExpression') return false;
  const props = args[0].properties;
  return (
    props.length > 0 &&
    props.every(
      (p) => p.type === 'Property' && p.value.type === 'Literal' && typeof p.value.value === 'string' && p.value.value.startsWith('data:audio/'),
    )
  );
}

/** Der Aufruf `stack(…)` am Anfang einer Kette (`stack(…).fast(2).room(.3)`), sonst null. */
function stackHead(e: Expression): CallExpression | null {
  let head: Expression = e;
  while (head.type === 'CallExpression' && head.callee.type === 'MemberExpression' && head.callee.object.type !== 'Super') {
    head = head.callee.object;
  }
  if (head.type === 'CallExpression' && head.callee.type === 'Identifier' && head.callee.name === 'stack') return head;
  return null;
}

export function programToTracks(code: string, prefer?: (name: string) => TrackType | undefined): ProgramResult {
  const comments: Comment[] = [];
  let body: Statement[];
  try {
    body = parse(code, { ...OPTIONS, onComment: comments }).body as Statement[];
  } catch (e) {
    return syntaxError(e);
  }

  /** Stellen im Code, die nicht in den Rahmen gehen (Tempo, Aufnahmen, Spuren zwischen anderem Code). */
  const cuts: [number, number][] = [];
  let tempo: { cps: number; unit: TempoUnit } | null = null;
  // Der erste Sammelkommentar gilt, alle gehören nicht in den Rahmen
  let board: Map<string, Spot> | null = null;
  for (const c of comments) {
    const spots = c.type === 'Block' ? readBoardComment(c.value) : null;
    if (!spots) continue;
    board ??= spots;
    cuts.push([c.start, c.end]);
  }
  const rest = body.filter((s) => {
    const t = tempoOf(s);
    if (t) tempo = t;
    if (!t && !isRecordings(s)) return true;
    cuts.push([s.start, s.end]);
    return false;
  });
  /** Code von `from` bis `to` ohne die Schnitte. */
  const slice = (from: number, to: number): string => {
    let text = '';
    let at = from;
    for (const [a, b] of [...cuts].sort((x, y) => x[0] - y[0])) {
      if (b <= at || a >= to) continue;
      text += code.slice(at, Math.max(at, a));
      at = Math.max(at, b);
    }
    return text + code.slice(at, Math.max(at, to));
  };
  /** Ein Namenskommentar (`/* drums *\/`) direkt vor `node`, ab `from` gesucht. */
  const nameComment = (from: number, node: Node): Comment | null => {
    const c = [...comments].reverse().find((x) => x.type === 'Block' && x.start >= from && x.end <= node.start);
    return c && code.slice(c.end, node.start).trim() === '' && isName(c.value.trim()) ? c : null;
  };
  const entry = (text: string, label?: { name: string; muted: boolean }): ProgramEntry => {
    let r = codeToTrack(text);
    if (r.ok && r.type === 'sound' && prefer?.(r.name || label?.name || '') === 'sampler') r = codeToTrack(text, 'sampler');
    if (r.ok) {
      const { ok: _, ...line } = r;
      if (label) {
        line.name ||= label.name;
        line.muted ||= label.muted;
      }
      return { kind: 'track', line };
    }
    const raw = rawLine(text);
    return { kind: 'raw', ...raw, name: raw.name || label?.name || '', muted: raw.muted || !!label?.muted };
  };
  /** Rahmen um die Spuren: davor (`start`) und danach (`end`), dazu die Aufrufe direkt am Stapel. */
  const frame = (start: number, end: number, chain = ''): Frame => ({
    before: tidy(slice(0, start)),
    chain,
    after: slice(end, code.length).trimEnd(),
  });

  /** Einträge eines Stapels. Ein Eintrag, der selbst ein Stapel ohne weitere Aufrufe ist, gibt seine Einträge her. */
  const stackEntries = (stack: CallExpression): ProgramEntry[] =>
    stack.arguments.flatMap((arg: Expression | SpreadElement, i) => {
      if (arg.type !== 'SpreadElement' && stackHead(arg) === arg) return stackEntries(arg as CallExpression);
      const from = i === 0 ? stack.callee.end : stack.arguments[i - 1].end;
      const comment = nameComment(from, arg);
      return [entry((comment ? `/*${comment.value}*/ ` : '') + code.slice(arg.start, arg.end))];
    });

  /**
   * Was Spuren hergibt, in der Reihenfolge im Code, alles zusammen in einen Stapel: jeder Ausdruck mit Label, jeder Ausdruck,
   * der mit `stack(…)` beginnt, und der letzte Ausdruck. Mehrere Stapel werden so einer; Strudel spielte sonst nur den letzten.
   * Aufrufe an einem Stapel (`.fast(2)`) gelten nur beim letzten Ausdruck für alle (`chain`), ein früherer bleibt eine Spur.
   */
  const last = rest[rest.length - 1];
  const sources: { start: number; end: number; entries: ProgramEntry[]; chain: string }[] = [];
  for (const s of rest) {
    if (s.type === 'LabeledStatement' && s.body.type === 'ExpressionStatement') {
      const e = s.body.expression;
      const label = labelTrack(s.label.name);
      // `$: stack(…)` gibt seine Einträge her; mit Namen oder stumm bleibt es eine Spur
      const entries = s.label.name === '$' && stackHead(e) === e ? stackEntries(e as CallExpression) : [entry(code.slice(e.start, e.end), label)];
      sources.push({ start: s.start, end: s.end, entries, chain: '' });
      continue;
    }
    if (s.type !== 'ExpressionStatement') continue;
    const e = s.expression;
    // Beim letzten Ausdruck bleibt ein `;` im Code danach
    const end = s === last ? e.end : s.end;
    const stack = stackHead(e);
    if (stack && (stack === e || s === last)) {
      sources.push({ start: s.start, end, entries: stackEntries(stack), chain: code.slice(stack.end, e.end) });
    } else if (stack || s === last) {
      // Ein Name als Kommentar direkt davor gehört zur Spur
      const comment = nameComment(rest[rest.indexOf(s) - 1]?.end ?? 0, e);
      const text = (comment ? `/*${comment.value}*/ ` : '') + code.slice(e.start, e.end);
      sources.push({ start: comment?.start ?? s.start, end, entries: [entry(text)], chain: '' });
    }
  }
  if (sources.length === 0) return { ok: true, entries: [], tempo, board, frame: frame(code.length, code.length) };

  // Code zwischen den Quellen kommt vor den Stapel, so ist alles definiert, was die Spuren brauchen
  const first = sources[0];
  const final = sources[sources.length - 1];
  for (const x of sources) cuts.push([x.start, x.end]);
  const between = tidy(slice(first.start, final.end));
  const f = frame(first.start, final.end, final.chain);
  return {
    ok: true,
    entries: sources.flatMap((x) => x.entries),
    tempo,
    board,
    frame: { ...f, before: [f.before, between].filter(Boolean).join('\n\n') },
  };
}

/** Leerzeilen am Rand weg, höchstens eine Leerzeile am Stück (Schnitte hinterlassen sonst Lücken). */
function tidy(text: string): string {
  return text.replace(/\n\s*\n(\s*\n)+/g, '\n\n').trim();
}
