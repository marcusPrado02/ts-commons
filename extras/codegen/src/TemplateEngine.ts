/** Token pattern: {{variableName}} */
const TOKEN_RE = /\{\{(\w+)\}\}/g;

/** Render a template string by replacing {{var}} tokens with context values. */
export function render(template: string, context: Record<string, string>): string {
  return template.replace(TOKEN_RE, (_, key: string) => context[key] ?? `{{${key}}}`);
}

/** Capitalise the first letter of a string. */
export function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s[0]!.toUpperCase() + s.slice(1);
}

/** Convert a PascalCase or camelCase name to kebab-case. */
export function toKebab(name: string): string {
  return name.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`).replace(/^-/, '');
}

/** Convert a PascalCase or camelCase name to snake_case. */
export function toSnake(name: string): string {
  return name.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`).replace(/^_/, '');
}

/** Convert a string to camelCase. */
export function toCamel(name: string): string {
  const cap = capitalize(name);
  return cap[0]!.toLowerCase() + cap.slice(1);
}

/** Pluralise a name naively (append 's' unless it already ends in 's'). */
export function pluralise(name: string): string {
  if (name.endsWith('s')) return `${name}es`;
  if (name.endsWith('y')) return `${name.slice(0, -1)}ies`;
  return `${name}s`;
}
