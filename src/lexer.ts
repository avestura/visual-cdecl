export type TokKind = 'id' | 'num' | 'punct' | 'eof';
export interface Token {
  kind: TokKind;
  text: string;
  pos: number;
}

export class ParseError extends Error {
  constructor(
    message: string,
    public pos: number,
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

const PUNCT = '()[]*,;+-/%<>=!~|&^?:.';

export function lex(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ kind: 'id', text: src.slice(i, j), pos: i });
      i = j;
    } else if (/[0-9]/.test(c)) {
      let j = i + 1;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ kind: 'num', text: src.slice(i, j), pos: i });
      i = j;
    } else if (src.startsWith('...', i)) {
      out.push({ kind: 'punct', text: '...', pos: i });
      i += 3;
    } else if (PUNCT.includes(c)) {
      out.push({ kind: 'punct', text: c, pos: i });
      i++;
    } else {
      throw new ParseError(`Unexpected character '${c}'`, i);
    }
  }
  out.push({ kind: 'eof', text: '', pos: src.length });
  return out;
}

export class Cursor {
  private i = 0;
  constructor(private toks: Token[]) {}

  peek(offset = 0): Token {
    return this.toks[Math.min(this.i + offset, this.toks.length - 1)];
  }
  next(): Token {
    const t = this.peek();
    if (this.i < this.toks.length - 1) this.i++;
    return t;
  }
  isPunct(s: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.kind === 'punct' && t.text === s;
  }
  isWord(s: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.kind === 'id' && t.text === s;
  }
  atEnd(): boolean {
    return this.peek().kind === 'eof';
  }
  err(message: string): ParseError {
    return new ParseError(message, this.peek().pos);
  }
  describe(): string {
    const t = this.peek();
    return t.kind === 'eof' ? 'end of input' : `'${t.text}'`;
  }
  expectPunct(s: string): void {
    if (!this.isPunct(s)) throw this.err(`Expected '${s}' but found ${this.describe()}`);
    this.next();
  }
  expectWord(s: string): void {
    if (!this.isWord(s)) throw this.err(`Expected '${s}' but found ${this.describe()}`);
    this.next();
  }
  expectEnd(): void {
    if (!this.atEnd()) throw this.err(`Unexpected ${this.describe()}`);
  }
}
