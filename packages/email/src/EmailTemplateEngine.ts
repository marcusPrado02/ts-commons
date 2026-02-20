import { EmailValidationError } from './EmailErrors';

/** Variables to interpolate into a template — must be scalar values. */
export type TemplateVariables = Record<string, string | number | boolean>;

/** The rendered output produced by a template engine. */
export interface EmailTemplate {
  readonly subject: string;
  readonly html?: string;
  readonly text?: string;
}

/** Port for rendering email templates. */
export interface EmailTemplateEngine {
  /** Render a registered template, substituting the given variables. */
  render(templateId: string, variables: TemplateVariables): Promise<EmailTemplate>;
  /** Register (or replace) a template by id. */
  register(templateId: string, template: EmailTemplate): void;
}

/** Replace `{{key}}` placeholders with string values from `variables`. */
function interpolate(str: string, variables: TemplateVariables): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value !== undefined ? String(value) : `{{${key}}}`;
  });
}

/**
 * In-memory template engine with `{{variable}}` interpolation.
 *
 * Suitable for testing and simple use-cases. Register templates before calling render().
 *
 * @example
 * ```ts
 * const engine = new InMemoryTemplateEngine();
 * engine.register('welcome', {
 *   subject: 'Welcome, {{name}}!',
 *   html: '<p>Hi {{name}}, thanks for signing up.</p>',
 * });
 * const rendered = await engine.render('welcome', { name: 'Alice' });
 * ```
 */
export class InMemoryTemplateEngine implements EmailTemplateEngine {
  private readonly templates = new Map<string, EmailTemplate>();

  register(templateId: string, template: EmailTemplate): void {
    this.templates.set(templateId, template);
  }

  async render(templateId: string, variables: TemplateVariables): Promise<EmailTemplate> {
    const template = this.templates.get(templateId);
    if (template === undefined) {
      throw new EmailValidationError('templateId', `Template '${templateId}' is not registered`);
    }

    const rendered: EmailTemplate = {
      subject: interpolate(template.subject, variables),
      ...(template.html !== undefined && { html: interpolate(template.html, variables) }),
      ...(template.text !== undefined && { text: interpolate(template.text, variables) }),
    };

    return Promise.resolve(rendered);
  }
}
