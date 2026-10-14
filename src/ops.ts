import { Decl, Param, Qual, Type, base, sortQuals, validate } from './types';

/** A path from the root type to a node: 'to' (pointer), 'of' (array), 'ret' / 'p<i>' (function). */
export type Path = string[];
export const pathKey = (p: Path): string => p.join('/');
export const parsePath = (s: string): Path => (s === '' ? [] : s.split('/'));

const isParamKey = (k: string) => /^p\d+$/.test(k);

function child(t: Type, k: string): Type | undefined {
  if (k === 'to' && t.kind === 'ptr') return t.to;
  if (k === 'of' && t.kind === 'array') return t.of;
  if (k === 'ret' && t.kind === 'func') return t.ret;
  if (isParamKey(k) && t.kind === 'func') return t.params[+k.slice(1)]?.type;
  return undefined;
}

function withChild(t: Type, k: string, c: Type): Type {
  if (k === 'to' && t.kind === 'ptr') return { ...t, to: c };
  if (k === 'of' && t.kind === 'array') return { ...t, of: c };
  if (k === 'ret' && t.kind === 'func') return { ...t, ret: c };
  if (isParamKey(k) && t.kind === 'func') {
    const i = +k.slice(1);
    return { ...t, params: t.params.map((p, j) => (j === i ? { ...p, type: c } : p)) };
  }
  throw new Error('Invalid selection');
}

export function getAt(t: Type, path: Path): Type | undefined {
  let cur: Type | undefined = t;
  for (const k of path) {
    if (!cur) return undefined;
    cur = child(cur, k);
  }
  return cur;
}

function mapAt(t: Type, path: Path, fn: (t: Type) => Type): Type {
  if (!path.length) return fn(t);
  const [k, ...rest] = path;
  const c = child(t, k);
  if (!c) throw new Error('Invalid selection');
  return withChild(t, k, mapAt(c, rest, fn));
}

/** The parameter record a path ends in, if the selected node is a function parameter. */
export function paramAt(d: Decl, path: Path): { func: Type; index: number; param: Param } | undefined {
  const last = path[path.length - 1];
  if (!last || !isParamKey(last)) return undefined;
  const func = getAt(d.type, path.slice(0, -1));
  if (!func || func.kind !== 'func') return undefined;
  const index = +last.slice(1);
  const param = func.params[index];
  return param ? { func, index, param } : undefined;
}

function update(d: Decl, path: Path, fn: (t: Type) => Type): Decl {
  const next: Decl = { ...d, type: mapAt(d.type, path, fn) };
  const e = validate(next);
  if (e) throw new Error(e);
  return next;
}

export const wrapPointer = (d: Decl, p: Path) => update(d, p, (t) => ({ kind: 'ptr', quals: [], to: t }));
export const wrapArray = (d: Decl, p: Path) => update(d, p, (t) => ({ kind: 'array', size: '3', of: t }));
export const wrapFunction = (d: Decl, p: Path) =>
  update(d, p, (t) => ({ kind: 'func', params: [], variadic: false, ret: t }));

export const removeLayer = (d: Decl, p: Path) =>
  update(d, p, (t) => (t.kind === 'ptr' ? t.to : t.kind === 'array' ? t.of : t.kind === 'func' ? t.ret : t));

export const toggleQual = (d: Decl, p: Path, q: Qual) =>
  update(d, p, (t) => {
    if (t.kind !== 'base' && t.kind !== 'ptr') return t;
    if (q === 'restrict' && t.kind !== 'ptr') return t;
    const has = t.quals.includes(q);
    return { ...t, quals: sortQuals(has ? t.quals.filter((x) => x !== q) : [...t.quals, q]) };
  });

export const setBaseName = (d: Decl, p: Path, name: string) =>
  update(d, p, (t) => (t.kind === 'base' ? { ...t, name } : t));

export const setArraySize = (d: Decl, p: Path, size: string | null) =>
  update(d, p, (t) => (t.kind === 'array' ? { ...t, size } : t));

export const addParam = (d: Decl, p: Path) =>
  update(d, p, (t) => (t.kind === 'func' ? { ...t, params: [...t.params, { name: null, type: base('int') }] } : t));

export const toggleVariadic = (d: Decl, p: Path) =>
  update(d, p, (t) => (t.kind === 'func' ? { ...t, variadic: !t.variadic } : t));

export function removeParam(d: Decl, p: Path): Decl {
  const info = paramAt(d, p);
  if (!info) return d;
  return update(d, p.slice(0, -1), (t) =>
    t.kind === 'func' ? { ...t, params: t.params.filter((_, i) => i !== info.index) } : t,
  );
}

export function setParamName(d: Decl, p: Path, name: string | null): Decl {
  const info = paramAt(d, p);
  if (!info) return d;
  return update(d, p.slice(0, -1), (t) =>
    t.kind === 'func' ? { ...t, params: t.params.map((q, i) => (i === info.index ? { ...q, name } : q)) } : t,
  );
}

export const setName = (d: Decl, name: string | null): Decl => ({ ...d, name });
