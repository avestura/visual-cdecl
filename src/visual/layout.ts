import { Decl, Qual, Type } from '../types';

/** An outgoing arrow, anchored at (dx, dy) inside its box and pointing at `target`. */
export interface Out {
  dx: number;
  dy: number;
  dashed: boolean;
  dot: boolean;
  target: Box;
}

export interface Cell {
  rx: number;
  ry: number;
  w: number;
  h: number;
  /** The real element node (first cell only); other cells are ghost copies. */
  box?: Box;
  ellipsis?: boolean;
}

export interface Row {
  text: string;
  ry: number;
  h: number;
  kind: 'head' | 'param' | 'ret' | 'more';
}

export interface Box {
  kind: Type['kind'];
  path: string[];
  type: Type;
  /** Absolute position for top-level boxes, relative to the parent for embedded cells. */
  x: number;
  y: number;
  w: number;
  h: number;
  quals: Qual[];
  /** Offset of the content below the qualifier strip. */
  top: number;
  label: string;
  cells: Cell[];
  rows: Row[];
  outs: Out[];
}

export interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed: boolean;
  dot: boolean;
}

export interface Layout {
  roots: Box[];
  edges: Edge[];
  width: number;
  height: number;
  nameLabel: { x: number; y: number; text: string } | null;
}

const CHAR_W = 8;
const GAP_X = 72;
const GAP_Y = 14;
const MARGIN = 16;
const QUAL_H = 15;

const textW = (s: string) => s.length * CHAR_W;

function newBox(type: Type, path: string[]): Box {
  return {
    kind: type.kind,
    path,
    type,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    quals: type.kind === 'base' || type.kind === 'ptr' ? type.quals : [],
    top: 0,
    label: '',
    cells: [],
    rows: [],
    outs: [],
  };
}

function buildBox(type: Type, path: string[]): Box {
  const b = newBox(type, path);
  b.top = b.quals.length ? QUAL_H : 0;
  switch (type.kind) {
    case 'base': {
      b.label = type.name;
      b.w = Math.max(60, textW(type.name) + 28, textW(b.quals.join(' ')) + 20);
      b.h = 38 + b.top;
      break;
    }
    case 'ptr': {
      b.w = Math.max(60, textW(b.quals.join(' ')) + 20);
      b.h = 38 + b.top;
      b.outs.push({ dx: b.w / 2, dy: b.top + 19, dashed: false, dot: true, target: buildBox(type.to, [...path, 'to']) });
      break;
    }
    case 'array': {
      const cell0 = buildBox(type.of, [...path, 'of']);
      b.label = type.size === null ? '[ ]' : `[${type.size}]`;
      const n = type.size !== null && /^\d+$/.test(type.size) ? parseInt(type.size, 10) : null;
      // Which slots to draw: indexes, or -1 for an ellipsis row.
      let slots: number[];
      if (n === null) slots = [0, 1, 2, -1];
      else if (n <= 4) slots = Array.from({ length: Math.max(n, 1) }, (_, i) => i);
      else slots = [0, 1, -1, n - 1];
      const pad = 8;
      let y = 24;
      for (const s of slots) {
        if (s === -1) {
          b.cells.push({ rx: 0, ry: y, w: cell0.w, h: 14, ellipsis: true });
          y += 14 + 4;
        } else {
          b.cells.push({ rx: 0, ry: y, w: cell0.w, h: cell0.h, box: s === 0 ? cell0 : undefined });
          y += cell0.h + 6;
        }
      }
      b.w = Math.max(cell0.w + pad * 2, textW(b.label) + 24);
      b.h = y - 6 + pad;
      for (const c of b.cells) c.rx = (b.w - c.w) / 2;
      cell0.x = b.cells[0].rx;
      cell0.y = b.cells[0].ry;
      break;
    }
    case 'func': {
      let y = 0;
      b.rows.push({ text: 'function', ry: y, h: 26, kind: 'head' });
      y += 26;
      type.params.forEach((p, i) => {
        const text = p.name ?? `arg ${i + 1}`;
        b.rows.push({ text, ry: y, h: 30, kind: 'param' });
        b.outs.push({ dx: 0, dy: y + 15, dashed: true, dot: true, target: buildBox(p.type, [...path, `p${i}`]) });
        y += 30;
      });
      if (type.variadic) {
        b.rows.push({ text: '...', ry: y, h: 26, kind: 'more' });
        y += 26;
      }
      b.rows.push({ text: 'returns', ry: y, h: 30, kind: 'ret' });
      b.outs.push({ dx: 0, dy: y + 15, dashed: false, dot: true, target: buildBox(type.ret, [...path, 'ret']) });
      y += 30;
      b.w = Math.max(110, ...b.rows.map((r) => textW(r.text) + 40));
      b.h = y;
      for (const o of b.outs) o.dx = b.w;
      break;
    }
  }
  return b;
}

interface Collected {
  ox: number;
  oy: number;
  out: Out;
}

/** All outgoing arrows of a box, including those of the array element embedded in it. */
export function collectOuts(b: Box, ox = 0, oy = 0, acc: Collected[] = []): Collected[] {
  for (const out of b.outs) acc.push({ ox: ox + out.dx, oy: oy + out.dy, out });
  if (b.kind === 'array') {
    const c = b.cells[0];
    if (c?.box) collectOuts(c.box, ox + c.rx, oy + c.ry, acc);
  }
  return acc;
}

function shift(b: Box, dy: number): void {
  b.y += dy;
  for (const o of collectOuts(b)) shift(o.out.target, dy);
}

/** Places `b` and everything it points at; returns the height of the subtree. */
function place(b: Box, x: number, top: number): number {
  b.x = x;
  const outs = collectOuts(b);
  if (!outs.length) {
    b.y = top;
    return b.h;
  }
  let cur = top;
  let centers = 0;
  let anchors = 0;
  for (const o of outs) {
    const h = place(o.out.target, x + b.w + GAP_X, cur);
    centers += o.out.target.y + o.out.target.h / 2;
    anchors += o.oy;
    cur += h + GAP_Y;
  }
  cur -= GAP_Y;
  let y = centers / outs.length - anchors / outs.length;
  if (y < top) {
    const d = top - y;
    for (const o of outs) shift(o.out.target, d);
    cur += d;
    y = top;
  }
  b.y = y;
  return Math.max(cur, y + b.h) - top;
}

export function layoutDecl(decl: Decl): Layout {
  const root = buildBox(decl.type, []);
  const hasName = !!decl.name;
  place(root, MARGIN, MARGIN + (hasName ? 22 : 0));

  const roots: Box[] = [];
  const queue = [root];
  while (queue.length) {
    const b = queue.shift()!;
    roots.push(b);
    for (const o of collectOuts(b)) queue.push(o.out.target);
  }

  const edges: Edge[] = [];
  let maxX = 0;
  let maxY = 0;
  for (const b of roots) {
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
    for (const o of collectOuts(b)) {
      const t = o.out.target;
      edges.push({
        x1: b.x + o.ox,
        y1: b.y + o.oy,
        x2: t.x - 3,
        y2: t.y + t.h / 2,
        dashed: o.out.dashed,
        dot: o.out.dot,
      });
    }
  }

  return {
    roots,
    edges,
    width: maxX + MARGIN,
    height: maxY + MARGIN,
    nameLabel: hasName ? { x: root.x, y: root.y - 8, text: decl.name! } : null,
  };
}
