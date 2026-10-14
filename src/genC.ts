import { Base, Decl, Type } from './types';

export function baseToC(b: Base): string {
  return [...b.quals, b.name].join(' ');
}

/** Renders `t` as a C declarator wrapped around `inner` (the name, or '' for an abstract type). */
export function typeToC(t: Type, inner = ''): string {
  switch (t.kind) {
    case 'base':
      return baseToC(t) + (inner ? ' ' + inner : '');
    case 'ptr': {
      const q = t.quals.join(' ');
      let s = '*' + q + (q && inner ? ' ' : '') + inner;
      if (t.to.kind === 'array' || t.to.kind === 'func') s = `(${s})`;
      return typeToC(t.to, s);
    }
    case 'array':
      return typeToC(t.of, `${inner}[${t.size ?? ''}]`);
    case 'func': {
      const ps = t.params.map((p) => typeToC(p.type, p.name ?? ''));
      if (t.variadic) ps.push('...');
      return typeToC(t.ret, `${inner}(${ps.join(', ')})`);
    }
  }
}

export function declToC(d: Decl): string {
  return typeToC(d.type, d.name ?? '');
}
