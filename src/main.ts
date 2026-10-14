import './style.css';
import { EXAMPLES } from './examples';
import { declToC } from './genC';
import { declToEnglish, typeToEnglish } from './genEnglish';
import { ParseError } from './lexer';
import * as ops from './ops';
import { Path, getAt, paramAt, parsePath, pathKey } from './ops';
import { parseC } from './parseC';
import { parseEnglish } from './parseEnglish';
import { Decl, Qual } from './types';
import { layoutDecl } from './visual/layout';
import { renderSvg } from './visual/render';

type Source = 'init' | 'english' | 'c' | 'visual' | 'editor-input';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const englishEl = $<HTMLTextAreaElement>('english');
const cEl = $<HTMLTextAreaElement>('c');
const englishMsg = $('english-msg');
const cMsg = $('c-msg');
const diagramEl = $('diagram');
const editorEl = $('editor');
const examplesEl = $<HTMLSelectElement>('examples');

let decl: Decl = parseC(EXAMPLES[0]);
let selected: Path = [];

// ---------- rendering & syncing ----------

function setDecl(next: Decl, source: Source): void {
  decl = next;
  if (!getAt(decl.type, selected)) selected = [];
  render(source);
}

function render(source: Source): void {
  if (source !== 'english') {
    englishEl.value = declToEnglish(decl);
    markValid(englishEl, englishMsg);
  }
  if (source !== 'c') {
    cEl.value = declToC(decl);
    markValid(cEl, cMsg);
  }
  diagramEl.innerHTML = renderSvg(layoutDecl(decl), pathKey(selected));
  if (source !== 'editor-input') renderEditor();
  try {
    history.replaceState(null, '', '#' + encodeURIComponent(declToC(decl)));
  } catch {
    /* hash sync is a nicety */
  }
}

function markValid(el: HTMLTextAreaElement, msg: HTMLElement): void {
  el.classList.remove('invalid');
  msg.textContent = '';
}

function markInvalid(el: HTMLTextAreaElement, msg: HTMLElement, e: unknown): void {
  el.classList.add('invalid');
  if (e instanceof ParseError && e.pos > 0) {
    msg.textContent = `${e.message} (at character ${e.pos + 1})`;
  } else {
    msg.textContent = e instanceof Error ? e.message : String(e);
  }
}

englishEl.addEventListener('input', () => {
  try {
    setDecl(parseEnglish(englishEl.value), 'english');
  } catch (e) {
    markInvalid(englishEl, englishMsg, e);
  }
});
cEl.addEventListener('input', () => {
  try {
    setDecl(parseC(cEl.value), 'c');
  } catch (e) {
    markInvalid(cEl, cMsg, e);
  }
});
// Normalise the text once the user leaves a pane, if it is valid.
englishEl.addEventListener('blur', () => {
  if (!englishEl.classList.contains('invalid')) englishEl.value = declToEnglish(decl);
});
cEl.addEventListener('blur', () => {
  if (!cEl.classList.contains('invalid')) cEl.value = declToC(decl);
});

// ---------- visual selection ----------

diagramEl.addEventListener('click', (ev) => {
  const g = (ev.target as Element).closest('[data-path]');
  selected = g ? parsePath(g.getAttribute('data-path') ?? '') : selected;
  render('visual');
});

// ---------- editor toolbar ----------

let toastTimer: number | undefined;
function toast(msg: string): void {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'alert');
  t.textContent = msg;
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.remove(), 3500);
}

/** Runs an edit; on failure (the edit would produce invalid C) shows why and changes nothing. */
function apply(fn: () => Decl, nextSel?: Path, source: Source = 'visual'): void {
  try {
    const next = fn();
    if (nextSel) selected = nextSel;
    setDecl(next, source);
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e));
  }
}

function button(text: string, onClick: () => void, opts: { on?: boolean; danger?: boolean; title?: string } = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn small' + (opts.on ? ' on' : '') + (opts.danger ? ' danger' : '');
  b.textContent = text;
  if (opts.title) b.title = opts.title;
  b.addEventListener('click', onClick);
  return b;
}

function group(...children: (HTMLElement | string)[]): HTMLElement {
  const g = document.createElement('div');
  g.className = 'group';
  g.append(...children);
  return g;
}

function field(label: string, value: string, opts: {
  placeholder?: string;
  narrow?: boolean;
  list?: string;
  validate: (v: string) => string | null;
  commit: (v: string) => void;
}) {
  const wrap = document.createElement('label');
  wrap.append(label + ' ');
  const input = document.createElement('input');
  input.value = value;
  input.spellcheck = false;
  input.autocomplete = 'off';
  if (opts.placeholder) input.placeholder = opts.placeholder;
  if (opts.narrow) input.className = 'narrow';
  if (opts.list) input.setAttribute('list', opts.list);
  input.addEventListener('input', () => {
    const err = opts.validate(input.value);
    input.classList.toggle('invalid', !!err);
    input.title = err ?? '';
    if (!err) opts.commit(input.value);
  });
  wrap.append(input);
  return wrap;
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const BASE_TYPES = [
  'void', 'char', 'signed char', 'unsigned char', 'short', 'unsigned short', 'int', 'unsigned int',
  'long', 'unsigned long', 'long long', 'unsigned long long', 'float', 'double', 'long double',
  '_Bool', 'size_t', 'ssize_t', 'ptrdiff_t', 'uint8_t', 'uint32_t', 'uint64_t', 'int32_t', 'int64_t', 'FILE',
];

function baseNameError(v: string): string | null {
  try {
    const d = parseC(`${v} x`);
    return d.type.kind === 'base' && d.type.quals.length === 0 ? null : 'Enter a plain type name';
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid type';
  }
}

function renderEditor(): void {
  editorEl.replaceChildren();
  const t = getAt(decl.type, selected);
  if (!t) return;

  const summary = document.createElement('div');
  summary.className = 'summary';
  const code = document.createElement('code');
  code.textContent = typeToEnglish(t);
  summary.append('Selected: ', code);
  editorEl.append(summary);

  const path = selected;
  const rerun = (fn: (d: Decl) => Decl, nextSel?: Path) => () => apply(() => fn(decl), nextSel);

  // Name of the variable (shown on the root) or of the selected parameter.
  const info = paramAt(decl, path);
  const nameField = info
    ? field('Parameter name', info.param.name ?? '', {
        placeholder: '(none)',
        validate: (v) => (v === '' || IDENT.test(v) ? null : 'Not a valid identifier'),
        commit: (v) => apply(() => ops.setParamName(decl, path, v === '' ? null : v), undefined, 'editor-input'),
      })
    : field('Variable name', decl.name ?? '', {
        placeholder: '(none)',
        validate: (v) => (v === '' || IDENT.test(v) ? null : 'Not a valid identifier'),
        commit: (v) => apply(() => ops.setName(decl, v === '' ? null : v), undefined, 'editor-input'),
      });

  // Type-specific controls.
  const specific: (HTMLElement | string)[] = [];
  if (t.kind === 'base') {
    specific.push(
      field('Type', t.name, {
        list: 'base-types',
        validate: baseNameError,
        commit: (v) => {
          const d = parseC(`${v} x`);
          if (d.type.kind === 'base') apply(() => ops.setBaseName(decl, path, d.type.kind === 'base' ? d.type.name : v), undefined, 'editor-input');
        },
      }),
    );
  }
  if (t.kind === 'array') {
    specific.push(
      field('Size', t.size ?? '', {
        placeholder: '(unsized)',
        narrow: true,
        validate: (v) => {
          try {
            const d = parseC(`int x[${v}]`);
            return d.type.kind === 'array' && (d.type.size ?? '') === v.replace(/\s+/g, '') ? null : 'Invalid size';
          } catch {
            return 'Invalid size';
          }
        },
        commit: (v) => apply(() => ops.setArraySize(decl, path, v.trim() === '' ? null : v.replace(/\s+/g, '')), undefined, 'editor-input'),
      }),
    );
  }
  if (t.kind === 'func') {
    specific.push(
      button('+ Add parameter', rerun((d) => ops.addParam(d, path))),
      button('Variadic (...)', rerun((d) => ops.toggleVariadic(d, path)), { on: t.variadic }),
    );
  }

  const quals: Qual[] = t.kind === 'ptr' ? ['const', 'volatile', 'restrict'] : ['const', 'volatile'];
  const qualButtons =
    t.kind === 'base' || t.kind === 'ptr'
      ? quals.map((q) => button(q, rerun((d) => ops.toggleQual(d, path, q)), { on: t.quals.includes(q) }))
      : [];

  const wrapButtons = [
    button('Pointer to this', rerun((d) => ops.wrapPointer(d, path)), { title: 'Wrap the selected type in a pointer' }),
    button('Array of this', rerun((d) => ops.wrapArray(d, path)), { title: 'Wrap the selected type in an array' }),
    button('Function returning this', rerun((d) => ops.wrapFunction(d, path)), { title: 'Make a function that returns the selected type' }),
  ];

  const removeButtons: HTMLElement[] = [];
  if (t.kind !== 'base') {
    removeButtons.push(button('Remove layer', rerun((d) => ops.removeLayer(d, path)), { danger: true, title: 'Remove this pointer/array/function, keeping what it points to' }));
  }
  if (info) {
    removeButtons.push(
      button('Remove parameter', rerun((d) => ops.removeParam(d, path), path.slice(0, -1)), { danger: true }),
    );
  }

  editorEl.append(
    group(nameField),
    ...(specific.length ? [group(...specific)] : []),
    ...(qualButtons.length ? [group('Qualifiers:', ...qualButtons)] : []),
    group('Wrap:', ...wrapButtons),
    ...(removeButtons.length ? [group(...removeButtons)] : []),
  );
}

// datalist for base type suggestions
{
  const dl = document.createElement('datalist');
  dl.id = 'base-types';
  for (const b of BASE_TYPES) dl.append(new Option(b));
  document.body.append(dl);
}

// ---------- chrome: examples, copy, theme ----------

for (const ex of EXAMPLES) examplesEl.append(new Option(ex, ex));
examplesEl.insertBefore(new Option('Examples…', '', true, true), examplesEl.firstChild);
examplesEl.options[0].disabled = true;
examplesEl.addEventListener('change', () => {
  selected = [];
  setDecl(parseC(examplesEl.value), 'init');
  examplesEl.selectedIndex = 0;
});

document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((b) => {
  b.addEventListener('click', async () => {
    const el = b.dataset.copy === 'c' ? cEl : englishEl;
    try {
      await navigator.clipboard.writeText(el.value);
      b.textContent = 'Copied';
    } catch {
      el.select();
      b.textContent = 'Select + Ctrl+C';
    }
    setTimeout(() => (b.textContent = 'Copy'), 1400);
  });
});

$('theme').addEventListener('click', () => {
  const root = document.documentElement;
  const dark = root.dataset.theme
    ? root.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  root.dataset.theme = next;
  try {
    localStorage.setItem('theme', next);
  } catch {
    /* ignore */
  }
});

// ---------- boot ----------

try {
  const fromHash = decodeURIComponent(location.hash.slice(1));
  if (fromHash) decl = parseC(fromHash);
} catch {
  /* fall back to the default example */
}
render('init');
