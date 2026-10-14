import { typeToEnglish } from '../genEnglish';
import { Box, Layout } from './layout';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function quals(b: Box): string {
  return b.quals.length ? `<text class="qual" x="${b.w / 2}" y="11" text-anchor="middle">${esc(b.quals.join(' '))}</text>` : '';
}

/** Draws the contents of a box (shape, text, cells) at the local origin. */
function boxBody(b: Box, sel: string): string {
  const title = `<title>${esc(typeToEnglish(b.type))}</title>`;
  switch (b.kind) {
    case 'base':
      return `${title}<rect class="shape" width="${b.w}" height="${b.h}" rx="8"/>${quals(b)}<text class="label" x="${b.w / 2}" y="${b.top + 24}" text-anchor="middle">${esc(b.label)}</text>`;
    case 'ptr':
      return `${title}<rect class="shape" width="${b.w}" height="${b.h}" rx="8"/>${quals(b)}<circle class="ptr-dot" cx="${b.w / 2}" cy="${b.top + 19}" r="5"/>`;
    case 'array': {
      const cells = b.cells
        .map((c) => {
          if (c.ellipsis) return `<text class="dim" x="${b.w / 2}" y="${c.ry + 11}" text-anchor="middle">⋮</text>`;
          if (c.box) return boxGroup(c.box, sel, c.rx, c.ry);
          return ghost(b, c.rx, c.ry, c.w, c.h);
        })
        .join('');
      return `${title}<rect class="shape" width="${b.w}" height="${b.h}" rx="8"/><text class="head" x="${b.w / 2}" y="16" text-anchor="middle">${esc(b.label)}</text>${cells}`;
    }
    case 'func': {
      const rows = b.rows
        .map((r, i) => {
          const sep = i > 0 ? `<line class="sep" x1="0" x2="${b.w}" y1="${r.ry}" y2="${r.ry}"/>` : '';
          const cls = r.kind === 'head' ? 'head' : r.kind === 'ret' ? 'label ret' : 'label';
          const anchor = r.kind === 'head' || r.kind === 'more' ? 'middle' : 'start';
          const x = anchor === 'middle' ? b.w / 2 : 14;
          return `${sep}<text class="${cls}" x="${x}" y="${r.ry + r.h / 2 + 5}" text-anchor="${anchor}">${esc(r.text)}</text>`;
        })
        .join('');
      return `${title}<rect class="shape" width="${b.w}" height="${b.h}" rx="8"/>${rows}`;
    }
  }
}

function ghost(parent: Box, rx: number, ry: number, w: number, h: number): string {
  const el = parent.type.kind === 'array' ? parent.type.of : null;
  const path = [...parent.path, 'of'].join('/');
  let inner = '';
  if (el?.kind === 'base') inner = `<text class="label dim" x="${w / 2}" y="${h / 2 + 5}" text-anchor="middle">${esc(el.name)}</text>`;
  else if (el?.kind === 'ptr') inner = `<circle class="ptr-dot dim" cx="${w / 2}" cy="${h / 2}" r="5"/>`;
  return `<g class="ghost" data-path="${esc(path)}" transform="translate(${rx},${ry})"><rect class="shape" width="${w}" height="${h}" rx="8"/>${inner}</g>`;
}

function boxGroup(b: Box, sel: string, x: number, y: number): string {
  const path = b.path.join('/');
  const cls = `node k-${b.kind}${path === sel ? ' sel' : ''}`;
  return `<g class="${cls}" data-path="${esc(path)}" transform="translate(${x},${y})">${boxBody(b, sel)}</g>`;
}

function edgePath(e: Layout['edges'][number]): string {
  const dx = Math.max(24, (e.x2 - e.x1) / 2);
  return `M${e.x1},${e.y1} C${e.x1 + dx},${e.y1} ${e.x2 - dx},${e.y2} ${e.x2},${e.y2}`;
}

/** Returns the SVG markup for a laid-out declaration. `sel` is the selected node's path key. */
export function renderSvg(layout: Layout, sel: string): string {
  const edges = layout.edges
    .map((e) => `<path class="edge${e.dashed ? ' dashed' : ''}" d="${edgePath(e)}" marker-end="url(#arrow)"/>`)
    .join('');
  const dots = layout.edges
    .filter((e) => e.dot)
    .map((e) => `<circle class="edge-dot" cx="${e.x1}" cy="${e.y1}" r="4.5"/>`)
    .join('');
  const boxes = layout.roots.map((b) => boxGroup(b, sel, b.x, b.y)).join('');
  const name = layout.nameLabel
    ? `<text class="varname" x="${layout.nameLabel.x}" y="${layout.nameLabel.y}">${esc(layout.nameLabel.text)}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}" role="img" aria-label="Diagram of the declared type">
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" class="arrow-head"/></marker></defs>
${boxes}${edges}${dots}${name}</svg>`;
}
