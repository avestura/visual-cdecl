import { Cursor, ParseError, lex } from './lexer';
import { BUILTIN, QUALS, TAGS, UNSUPPORTED, isKeyword } from './keywords';
import { Decl, Param, Qual, Type, base, sortQuals, validate } from './types';

const ENGLISH_WORDS = new Set(['declare', 'as', 'pointer', 'to', 'array', 'of', 'function', 'returning']);
const isReserved = (s: string) => isKeyword(s) || ENGLISH_WORDS.has(s);

/** Parses `declare foo as pointer to function (pointer to const void) returning int`. */
export function parseEnglish(src: string): Decl {
  const c = new Cursor(lex(src));
  c.expectWord('declare');
  let name: string | null = null;
  if (!c.isWord('as')) {
    const t = c.peek();
    if (t.kind !== 'id' || isReserved(t.text)) throw c.err(`Expected a name or 'as' but found ${c.describe()}`);
    name = c.next().text;
  }
  c.expectWord('as');
  const type = parseType(c);
  c.expectEnd();
  const decl: Decl = { name, type };
  const e = validate(decl);
  if (e) throw new ParseError(e, 0);
  return decl;
}

function parseQuals(c: Cursor): Qual[] {
  const q: Qual[] = [];
  while (c.peek().kind === 'id' && QUALS.has(c.peek().text)) q.push(c.next().text as Qual);
  return sortQuals(q);
}

function parseType(c: Cursor): Type {
  const quals = parseQuals(c);

  if (c.isWord('pointer')) {
    c.next();
    c.expectWord('to');
    return { kind: 'ptr', quals, to: parseType(c) };
  }
  if (c.isWord('array')) {
    if (quals.length) throw c.err('Qualifiers cannot apply to an array here; put them on the element type');
    c.next();
    const parts: string[] = [];
    while (!c.isWord('of')) {
      if (c.atEnd()) throw c.err("Expected 'of' in array type");
      parts.push(c.next().text);
    }
    c.next();
    return { kind: 'array', size: parts.length ? parts.join('') : null, of: parseType(c) };
  }
  if (c.isWord('function')) {
    if (quals.length) throw c.err('Qualifiers cannot apply to a function');
    c.next();
    const params: Param[] = [];
    let variadic = false;
    if (c.isPunct('(')) {
      c.next();
      if (c.isPunct(')')) {
        c.next();
      } else {
        for (;;) {
          if (c.isPunct('...')) {
            c.next();
            variadic = true;
            c.expectPunct(')');
            break;
          }
          let name: string | null = null;
          const t = c.peek();
          if (t.kind === 'id' && !isReserved(t.text) && c.isWord('as', 1)) {
            name = c.next().text;
            c.next();
          }
          params.push({ name, type: parseType(c) });
          if (c.isPunct(',')) {
            c.next();
            continue;
          }
          c.expectPunct(')');
          break;
        }
      }
    }
    let ret: Type = base('void');
    if (c.isWord('returning')) {
      c.next();
      ret = parseType(c);
    }
    return { kind: 'func', params, variadic, ret };
  }
  return parseBase(c, quals);
}

function parseBase(c: Cursor, quals: Qual[]): Type {
  const q = [...quals];
  const words: string[] = [];
  let named = false;
  for (;;) {
    const t = c.peek();
    if (t.kind !== 'id') break;
    if (QUALS.has(t.text)) {
      q.push(c.next().text as Qual);
    } else if (BUILTIN.has(t.text)) {
      if (named) throw c.err(`Unexpected '${t.text}' after type name`);
      words.push(c.next().text);
    } else if (TAGS.has(t.text)) {
      if (words.length) throw c.err(`Unexpected '${t.text}' in type`);
      c.next();
      const tag = c.peek();
      if (tag.kind !== 'id' || isReserved(tag.text)) throw c.err(`Expected a name after '${t.text}'`);
      c.next();
      words.push(`${t.text} ${tag.text}`);
      named = true;
    } else if (UNSUPPORTED.has(t.text)) {
      throw c.err(`'${t.text}' is not supported`);
    } else if (ENGLISH_WORDS.has(t.text)) {
      break;
    } else if (words.length === 0) {
      words.push(c.next().text);
      named = true;
    } else {
      break;
    }
  }
  if (!words.length) throw c.err(`Expected a type but found ${c.describe()}`);
  return base(words.join(' '), sortQuals(q));
}
