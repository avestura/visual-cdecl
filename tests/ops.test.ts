import { describe, expect, it } from 'vitest';
import { parseC } from '../src/parseC';
import { declToC } from '../src/genC';
import * as ops from '../src/ops';
import { layoutDecl } from '../src/visual/layout';
import { renderSvg } from '../src/visual/render';
import { EXAMPLES } from '../src/examples';

describe('visual edit operations', () => {
  it('wraps and unwraps layers', () => {
    let d = parseC('int x');
    d = ops.wrapPointer(d, []);
    expect(declToC(d)).toBe('int *x');
    d = ops.wrapArray(d, []);
    expect(declToC(d)).toBe('int *x[3]');
    d = ops.wrapFunction(d, ['of', 'to']);
    expect(declToC(d)).toBe('int (*x[3])()');
    d = ops.removeLayer(d, []);
    expect(declToC(d)).toBe('int (*x)()');
  });

  it('toggles qualifiers on pointers and bases', () => {
    let d = parseC('char *p');
    d = ops.toggleQual(d, [], 'const');
    d = ops.toggleQual(d, ['to'], 'const');
    expect(declToC(d)).toBe('const char *const p');
    d = ops.toggleQual(d, [], 'const');
    expect(declToC(d)).toBe('const char *p');
  });

  it('edits parameters', () => {
    let d = parseC('int f()');
    d = ops.addParam(d, []);
    d = ops.setParamName(d, ['p0'], 'n');
    d = ops.toggleVariadic(d, []);
    expect(declToC(d)).toBe('int f(int n, ...)');
    d = ops.removeParam(d, ['p0']);
    expect(declToC(d)).toBe('int f(...)');
  });

  it('refuses edits that would produce invalid C', () => {
    expect(() => ops.wrapArray(parseC('int f()'), [])).toThrow(/array of functions/);
    expect(() => ops.wrapFunction(parseC('int a[3]'), [])).toThrow(/return an array/);
  });
});

describe('visual rendering', () => {
  it('lays out every example without overlapping top-level boxes in a column', () => {
    for (const ex of EXAMPLES) {
      const layout = layoutDecl(parseC(ex));
      expect(layout.width).toBeGreaterThan(0);
      const byX = new Map<number, { y: number; h: number }[]>();
      for (const b of layout.roots) byX.set(b.x, [...(byX.get(b.x) ?? []), { y: b.y, h: b.h }]);
      for (const boxes of byX.values()) {
        boxes.sort((a, b) => a.y - b.y);
        for (let i = 1; i < boxes.length; i++) expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i - 1].y + boxes[i - 1].h);
      }
      expect(renderSvg(layout, '')).toContain('<svg');
    }
  });
});
