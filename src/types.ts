export type Qual = 'const' | 'volatile' | 'restrict';
export const QUAL_ORDER: Qual[] = ['const', 'volatile', 'restrict'];

export interface Base {
  kind: 'base';
  /** e.g. "int", "unsigned long", "struct node", "size_t" */
  name: string;
  quals: Qual[];
}
export interface Ptr {
  kind: 'ptr';
  quals: Qual[];
  to: Type;
}
export interface Arr {
  kind: 'array';
  /** Size expression as written, or null for an unsized array. */
  size: string | null;
  of: Type;
}
export interface Param {
  name: string | null;
  type: Type;
}
export interface Func {
  kind: 'func';
  params: Param[];
  variadic: boolean;
  ret: Type;
}
export type Type = Base | Ptr | Arr | Func;

export interface Decl {
  name: string | null;
  type: Type;
}

export const base = (name: string, quals: Qual[] = []): Base => ({ kind: 'base', name, quals });

export function sortQuals(q: Iterable<Qual>): Qual[] {
  const s = new Set(q);
  return QUAL_ORDER.filter((x) => s.has(x));
}

/** Returns an error message if the declaration is not valid C, otherwise null. */
export function validate(d: Decl): string | null {
  return walk(d.type);
}

function walk(t: Type): string | null {
  switch (t.kind) {
    case 'base':
      return null;
    case 'ptr':
      return walk(t.to);
    case 'array':
      if (t.of.kind === 'func') return 'An array of functions is not allowed (use an array of pointers to functions)';
      if (t.of.kind === 'base' && t.of.name === 'void') return 'An array of void is not allowed (use an array of void pointers)';
      return walk(t.of);
    case 'func': {
      if (t.ret.kind === 'array') return 'A function cannot return an array (return a pointer instead)';
      if (t.ret.kind === 'func') return 'A function cannot return a function (return a pointer to a function)';
      for (const p of t.params) {
        const e = walk(p.type);
        if (e) return e;
      }
      return walk(t.ret);
    }
  }
}
