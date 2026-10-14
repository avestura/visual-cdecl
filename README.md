# Visual cdecl

A [cdecl](https://cdecl.org)-style translator for C declarations with a third view: an interactive diagram of boxes and arrows. Edit any of the three and the other two update as you type.

**Live demo:** http://github.avestura.dev/visual-cdecl/

| View | Example |
| --- | --- |
| English | `declare foo as pointer to function (pointer to const void) returning pointer to array 3 of int` |
| C | `int (*(*foo)(const void *))[3]` |
| Visual | boxes for values, dots and arrows for pointers, stacked cells for arrays, a row-per-parameter box for functions |

The interface follows the [Boxy](https://github.com/avestura/boxy-design-skill) design system in its `blueprint` mode: zero radius, 1px hairlines, hard-offset shadows only, a mono-label type system and a rationed accent. The vendored Boxy CSS lives in `src/boxy/`, and `node scripts/boxy-check.mjs index.html src/style.css src/main.ts src/visual` validates the app against it.

## Features

- **Three synced views.** Type English, type C, or edit the diagram.
- **Click-to-edit diagram.** Select any box, then wrap it in a pointer, array or function, toggle `const` / `volatile` / `restrict`, change the base type, resize an array, add, remove or rename parameters, and remove layers.
- **Validation.** Invalid C (arrays of functions, functions returning arrays or functions) is rejected with an explanation. A half-typed pane shows its error without losing the last valid state.
- **Shareable.** The current declaration lives in the URL hash.
- **Examples, copy buttons, light/dark theme.**

## Supported grammar

Pointers, arrays (sized, unsized, expression sizes such as `N+1`), functions (named or unnamed parameters, `(void)`, `()` and `...`), `const` / `volatile` / `restrict`, built-in types (`unsigned long long`, ...), `struct` / `union` / `enum` tags and typedef names.

English form: `declare <name> as <type>` where `<type>` is one of

```
[const|volatile|restrict]* pointer to <type>
array [<size>] of <type>
function [(<param>, ...)] [returning <type>]     # <param> = [name as] <type> | ...
[qualifiers] <base type>
```

Not supported (yet): storage classes (`static`, `extern`, ...), `_Atomic`, multiple declarators per line, blocks, C++ references.

## Development

```sh
npm install
npm run dev        # local dev server
npm test           # parser / generator / editing tests
npm run build      # type-check and build into dist/
```

Plain TypeScript and Vite, with no runtime dependencies. The diagram is SVG generated from the same AST that both text parsers produce.

```
src/types.ts          shared AST (base / pointer / array / function) + validation
src/parseC.ts         C declarator parser        src/genC.ts        AST -> C
src/parseEnglish.ts   English parser             src/genEnglish.ts  AST -> English
src/ops.ts            immutable edit operations used by the diagram editor
src/visual/           box/arrow layout and SVG rendering
```

## License

MIT. Inspired by cdecl and [cdecl-blocks](https://github.com/ridiculousfish/cdecl-blocks); this is an independent implementation.
