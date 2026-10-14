import { Decl, Type } from './types';

export function typeToEnglish(t: Type): string {
  switch (t.kind) {
    case 'base':
      return [...t.quals, t.name].join(' ');
    case 'ptr':
      return [...t.quals, 'pointer to', typeToEnglish(t.to)].join(' ');
    case 'array':
      return `array ${t.size !== null ? t.size + ' ' : ''}of ${typeToEnglish(t.of)}`;
    case 'func': {
      const ps = t.params.map((p) => (p.name ? `${p.name} as ` : '') + typeToEnglish(p.type));
      if (t.variadic) ps.push('...');
      return `function ${ps.length ? `(${ps.join(', ')}) ` : ''}returning ${typeToEnglish(t.ret)}`;
    }
  }
}

export function declToEnglish(d: Decl): string {
  return `declare ${d.name ? d.name + ' ' : ''}as ${typeToEnglish(d.type)}`;
}
