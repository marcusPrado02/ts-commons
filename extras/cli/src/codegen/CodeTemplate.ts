/**
 * Manages named Handlebars-style code generation templates.
 * Templates use `{{name}}` as the only placeholder (no dependency on handlebars).
 *
 * @example
 * ```typescript
 * const reg = new CodeTemplate();
 * reg.register('entity', 'export class {{name}} {}');
 * const output = reg.render('entity', { name: 'User' });
 * ```
 */
export class CodeTemplate {
  private readonly templates = new Map<string, string>();

  /** Store a named template string. */
  register(name: string, template: string): void {
    this.templates.set(name, template);
  }

  /** Returns true when a template with this name is registered. */
  has(name: string): boolean {
    return this.templates.has(name);
  }

  /** Retrieve the raw template string. */
  get(name: string): string | undefined {
    return this.templates.get(name);
  }

  /** All registered template names. */
  names(): string[] {
    return [...this.templates.keys()];
  }

  templateCount(): number {
    return this.templates.size;
  }

  /**
   * Render a template by replacing every `{{key}}` placeholder with the
   * corresponding value from `vars`.  Unknown placeholders are left unchanged.
   * Returns `undefined` when the template is not found.
   */
  render(name: string, vars: Record<string, string>): string | undefined {
    const tpl = this.templates.get(name);
    if (tpl === undefined) return undefined;
    return tpl.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
  }

  /** Remove a registered template. Returns `true` if it existed. */
  remove(name: string): boolean {
    return this.templates.delete(name);
  }

  clear(): void {
    this.templates.clear();
  }

  /**
   * Clone this registry into a new instance (useful for test isolation).
   */
  clone(): CodeTemplate {
    const copy = new CodeTemplate();
    for (const [k, v] of this.templates.entries()) {
      copy.register(k, v);
    }
    return copy;
  }
}
