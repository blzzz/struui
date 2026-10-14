import type { CloseToken, GroupType, Modifiers, OpenToken, RawToken, SoundToken, Token } from './types.ts';

/**
 * Wandelt die flache Steinliste in einen Baum um und erkennt Klammerfehler.
 * Fehlerhafte Eingaben sind erlaubt (die Nutzerin legt Steine frei hin), werden aber gemeldet.
 */

export type ParseErrorCode =
  | 'unmatched-close'
  | 'mismatched-close'
  | 'unclosed-open'
  /** Strudel lehnt leere Klammern ab (`[]`, `<>`). */
  | 'empty-group'
  /** Strudels eigene Grammatik lehnt die Spur ab, obwohl die Klammern stimmen (siehe syntax/analyze.ts). */
  | 'strudel-syntax';

export interface ParseError {
  code: ParseErrorCode;
  tokenId: string;
  /** Technische Meldung, falls vorhanden (z. B. von Strudels Parser). */
  detail?: string;
}

export interface LeafNode {
  type: 'leaf';
  token: SoundToken | RawToken;
}

export interface GroupNode {
  type: 'group';
  group: GroupType;
  children: SeqNode[];
  /** Modifier der schliessenden Klammer (bei `{` immer leer). */
  mods: Modifiers;
  /** Modulowert, nur bei `{`. */
  steps: number | null;
  openId: string;
  closeId: string;
}

export type SeqNode = LeafNode | GroupNode;

export interface ParseResult {
  nodes: SeqNode[];
  errors: ParseError[];
  errorIds: Set<string>;
  /** Pro Stein: die Gruppen, in denen er liegt (aussen nach innen). Klammern zählen zu ihrer eigenen Gruppe. */
  depth: Map<string, GroupType[]>;
}

interface Frame {
  open: OpenToken | null;
  children: SeqNode[];
}

export function parse(tokens: readonly Token[]): ParseResult {
  const stack: Frame[] = [{ open: null, children: [] }];
  const errors: ParseError[] = [];
  const depth = new Map<string, GroupType[]>();
  const groups = (): GroupType[] =>
    stack.slice(1).map((f) => (f.open as OpenToken).group);

  for (const token of tokens) {
    const top = stack[stack.length - 1];
    if (token.kind === 'sound' || token.kind === 'raw') {
      top.children.push({ type: 'leaf', token });
      depth.set(token.id, groups());
    } else if (token.kind === 'open') {
      stack.push({ open: token, children: [] });
      depth.set(token.id, groups());
    } else {
      depth.set(token.id, groups());
      if (stack.length > 1 && top.open && top.open.group === token.group) {
        stack.pop();
        if (top.children.length === 0) {
          errors.push({ code: 'empty-group', tokenId: token.id }, { code: 'empty-group', tokenId: (top.open as OpenToken).id });
        }
        stack[stack.length - 1].children.push(closeToGroup(top, token));
      } else {
        errors.push({
          code: stack.length > 1 ? 'mismatched-close' : 'unmatched-close',
          tokenId: token.id,
        });
      }
    }
  }
  for (let i = 1; i < stack.length; i += 1) {
    errors.push({ code: 'unclosed-open', tokenId: (stack[i].open as OpenToken).id });
  }
  return {
    nodes: stack[0].children,
    errors,
    errorIds: new Set(errors.map((e) => e.tokenId)),
    depth,
  };
}

function closeToGroup(frame: Frame, close: CloseToken): GroupNode {
  const open = frame.open as OpenToken;
  return {
    type: 'group',
    group: open.group,
    children: frame.children,
    mods: open.group === '{' ? { random: null, repeat: null } : { random: close.random, repeat: close.repeat },
    steps: open.group === '{' ? close.steps : null,
    openId: open.id,
    closeId: close.id,
  };
}
