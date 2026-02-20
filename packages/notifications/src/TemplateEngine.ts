import { NotificationTemplateNotFoundError } from './NotificationErrors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

function applyData(template: string, data: Readonly<Record<string, string>>): string {
  return template.replace(PLACEHOLDER_RE, (_, key: string) => data[key] ?? '');
}

// ---------------------------------------------------------------------------
// TemplateEngine
// ---------------------------------------------------------------------------

/**
 * Registry for notification body/subject templates with `{{variable}}` placeholder
 * substitution.  Thread-safe for reads; `register` is synchronous.
 *
 * @example
 * ```ts
 * const engine = new TemplateEngine();
 * engine.register('welcome', 'Hello, {{name}}! Your code is {{code}}.');
 * engine.render('welcome', { name: 'Alice', code: '1234' });
 * // → 'Hello, Alice! Your code is 1234.'
 * ```
 */
export class TemplateEngine {
  private readonly templates = new Map<string, string>();

  /** Register or overwrite a template by id. */
  register(id: string, template: string): void {
    this.templates.set(id, template);
  }

  /**
   * Render a registered template with the supplied data map.
   * Placeholders with no matching key are replaced with an empty string.
   *
   * @throws {@link NotificationTemplateNotFoundError} if `id` is not registered.
   */
  render(id: string, data: Readonly<Record<string, string>> = {}): string {
    const template = this.templates.get(id);
    if (template === undefined) throw new NotificationTemplateNotFoundError(id);
    return applyData(template, data);
  }

  /**
   * Render a raw template string (not registered) with the supplied data map.
   * Useful for one-off rendering without registering.
   */
  renderRaw(template: string, data: Readonly<Record<string, string>> = {}): string {
    return applyData(template, data);
  }

  /** Return `true` if a template with the given id is registered. */
  has(id: string): boolean {
    return this.templates.has(id);
  }

  /** Remove all registered templates. */
  clear(): void {
    this.templates.clear();
  }
}
