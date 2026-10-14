import { Cursor, ParseError, lex } from './lexer';
import { BUILTIN, QUALS, TAGS, UNSUPPORTED, isKeyword } from './keywords';
import { Base, Decl, Param, Qual, Type, sortQuals, validate } from './types';

type Wrap = (t: Type) => Type;
interface Declarator {
  name: string | null;
  wrap: Wrap;
}

/** Parses a single C declaration such as `int (*foo)(const void *)`. A trailing `;` is optional. */
export function parseC(src: string): Decl {
  const c = new Cursor(lex(src));
  const base = parseSpecifiers(c);
  const d = parseDeclarator(c);
  if (c.isPunct(';')) c.next();
  c.expectEnd();
  const decl: Decl = { name: d.name, type: d.wrap(base) };
  const e = validate(decl);
  if (e) throw new ParseError(e, 0);
  return decl;
}

function parseQuals(c: Cursor): Qual[] {
  const q: Qual[] = [];
  while (c.peek().kind === 'id' && QUALS.has(c.peek().text)) q.push(c.next().text as Qual);
  return sortQuals(q);
}

function parseSpecifiers(c: Cursor): Base {
  const quals: Qual[] = [];
  const words: string[] = [];
  let named = false; // saw a typedef name or struct/union/enum tag
  for (;;) {
    const t = c.peek();
    if (t.kind !== 'id') break;
    if (QUALS.has(t.text)) {
      quals.push(c.next().text as Qual);
    } else if (BUILTIN.has(t.text)) {
      if (named) throw c.err(`Unexpected '${t.text}' after type name`);
      words.push(c.next().text);
    } else if (TAGS.has(t.text)) {
      if (words.length) throw c.err(`Unexpected '${t.text}' in type`);
      c.next();
      const tag = c.peek();
      if (tag.kind !== 'id' || isKeyword(tag.text)) throw c.err(`Expected a name after '${t.text}'`);
      c.next();
      words.push(`${t.text} ${tag.text}`);
      named = true;
    } else if (UNSUPPORTED.has(t.text)) {
      throw c.err(`'${t.text}' is not supported`);
    } else if (words.length === 0) {
      words.push(c.next().text); // typedef name
      named = true;
    } else {
      break;
    }
  }
  if (!words.length) throw c.err(`Expected a type but found ${c.describe()}`);
  return { kind: 'base', name: words.join(' '), quals: sortQuals(quals) };
}

/** Is the `(` at the cursor the start of a grouping declarator (as opposed to a parameter list)? */
function isGrouping(c: Cursor): boolean {
  const n = c.peek(1);
  if (n.kind === 'punct') return n.text === '*' || n.text === '(' || n.text === '[';
  return n.kind === 'id' && !isKeyword(n.text);
}

function parseDeclarator(c: Cursor): Declarator {
  const ptrs: Qual[][] = [];
  while (c.isPunct('*')) {
    c.next();
    ptrs.push(parseQuals(c));
  }

  let name: string | null = null;
  let inner: Wrap = (t) => t;
  if (c.isPunct('(') && isGrouping(c)) {
    c.next();
    const d = parseDeclarator(c);
    c.expectPunct(')');
    name = d.name;
    inner = d.wrap;
  } else if (c.peek().kind === 'id' && !isKeyword(c.peek().text)) {
    name = c.next().text;
  }

  const suffixes: Wrap[] = [];
  for (;;) {
    if (c.isPunct('[')) {
      c.next();
      let depth = 0;
      let size = '';
      while (!(depth === 0 && c.isPunct(']'))) {
        if (c.atEnd()) throw c.err("Expected ']'");
        if (c.isPunct('[')) depth++;
        if (c.isPunct(']')) depth--;
        size += c.next().text;
      }
      c.next();
      const s = size === '' ? null : size;
      suffixes.push((t) => ({ kind: 'array', size: s, of: t }));
    } else if (c.isPunct('(')) {
      c.next();
      const { params, variadic } = parseParams(c);
      suffixes.push((t) => ({ kind: 'func', params, variadic, ret: t }));
    } else break;
  }

  return {
    name,
    wrap: (t) => {
      let r = t;
      for (const q of ptrs) r = { kind: 'ptr', quals: q, to: r };
      for (let i = suffixes.length - 1; i >= 0; i--) r = suffixes[i](r);
      return inner(r);
    },
  };
}

function parseParams(c: Cursor): { params: Param[]; variadic: boolean } {
  const params: Param[] = [];
  let variadic = false;
  if (c.isPunct(')')) {
    c.next();
    return { params, variadic };
  }
  for (;;) {
    if (c.isPunct('...')) {
      c.next();
      variadic = true;
      c.expectPunct(')');
      break;
    }
    const base = parseSpecifiers(c);
    const d = parseDeclarator(c);
    params.push({ name: d.name, type: d.wrap(base) });
    if (c.isPunct(',')) {
      c.next();
      continue;
    }
    c.expectPunct(')');
    break;
  }
  return { params, variadic };
}
