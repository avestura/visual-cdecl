import { describe, expect, it } from 'vitest';
import { parseC } from '../src/parseC';
import { parseEnglish } from '../src/parseEnglish';
import { declToC } from '../src/genC';
import { declToEnglish } from '../src/genEnglish';
import { EXAMPLES } from '../src/examples';

describe('cdecl', () => {
  it('handles the headline example in both directions', () => {
    const english =
      'declare foo as pointer to function (pointer to const void) returning pointer to array 3 of int';
    const c = 'int (*(*foo)(const void *))[3]';
    expect(declToEnglish(parseC(c))).toBe(english);
    expect(declToC(parseEnglish(english))).toBe(c);
  });

  it('parses simple pointers', () => {
    expect(declToEnglish(parseC('int *var'))).toBe('declare var as pointer to int');
  });

  it('distinguishes const placement', () => {
    expect(declToEnglish(parseC('const char *p'))).toBe('declare p as pointer to const char');
    expect(declToEnglish(parseC('char *const p'))).toBe('declare p as const pointer to char');
    expect(declToEnglish(parseC('const char *const p'))).toBe('declare p as const pointer to const char');
  });

  it('reads arrays of pointers vs pointers to arrays', () => {
    expect(declToEnglish(parseC('int *a[3]'))).toBe('declare a as array 3 of pointer to int');
    expect(declToEnglish(parseC('int (*a)[3]'))).toBe('declare a as pointer to array 3 of int');
    expect(declToEnglish(parseC('int a[2][3]'))).toBe('declare a as array 2 of array 3 of int');
  });

  it('handles signal()', () => {
    const c = 'void (*signal(int sig, void (*handler)(int)))(int)';
    expect(declToEnglish(parseC(c))).toBe(
      'declare signal as function (sig as int, handler as pointer to function (int) returning void) returning pointer to function (int) returning void',
    );
  });

  it('handles variadics, empty and void parameter lists', () => {
    expect(declToC(parseC('int printf(const char *fmt, ...)'))).toBe('int printf(const char *fmt, ...)');
    expect(declToEnglish(parseC('int f()'))).toBe('declare f as function returning int');
    expect(declToEnglish(parseC('int f(void)'))).toBe('declare f as function (void) returning int');
  });

  it('rejects invalid C types', () => {
    expect(() => parseC('int f()[3]')).toThrow(/return an array/);
    expect(() => parseC('int f()()')).toThrow(/return a function/);
    expect(() => parseC('int a[3]()')).toThrow();
    expect(() => parseC('int (a[3])()')).toThrow(/array of functions/);
    expect(() => parseEnglish('declare x as array 3 of function returning int')).toThrow(/array of functions/);
  });

  it('reports syntax errors', () => {
    expect(() => parseC('int (*foo')).toThrow();
    expect(() => parseC('static int x')).toThrow(/not supported/);
    expect(() => parseEnglish('declare x as pointer int')).toThrow(/Expected 'to'/);
    expect(() => parseEnglish('foo')).toThrow();
  });

  it('supports struct tags, typedef names and multi-word builtins', () => {
    expect(declToC(parseC('struct node *next'))).toBe('struct node *next');
    expect(declToC(parseC('size_t n'))).toBe('size_t n');
    expect(declToC(parseC('unsigned long long x'))).toBe('unsigned long long x');
  });

  it('round-trips every example through English and back', () => {
    for (const ex of EXAMPLES) {
      const d = parseC(ex);
      const c = declToC(d);
      expect(c).toBe(ex);
      expect(declToC(parseEnglish(declToEnglish(d)))).toBe(c);
    }
  });
});
