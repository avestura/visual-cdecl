export const QUALS = new Set(['const', 'volatile', 'restrict']);
export const BUILTIN = new Set([
  'void', 'char', 'short', 'int', 'long', 'float', 'double',
  'signed', 'unsigned', '_Bool', 'bool', '_Complex',
]);
export const TAGS = new Set(['struct', 'union', 'enum']);
export const UNSUPPORTED = new Set([
  'typedef', 'extern', 'static', 'register', 'auto', 'inline', '_Thread_local', 'thread_local', '_Atomic',
]);

export const isKeyword = (s: string) => QUALS.has(s) || BUILTIN.has(s) || TAGS.has(s) || UNSUPPORTED.has(s);
