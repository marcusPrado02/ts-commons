/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import type { ZodType } from 'zod';
import { Result } from '@acme/kernel';
import type { ConfigSchema } from './ConfigSchema';

/**
 * A {@link ConfigSchema} backed by a Zod schema.
 *
 * Converts Zod parse errors into an array of human-readable strings in the
 * form `"field.path: message"` so they integrate cleanly with
 * {@link ConfigLoader}.
 *
 * @example
 * ```ts
 * const schema = new ZodConfigSchema(
 *   z.object({ PORT: z.coerce.number().int().min(1) })
 * );
 * const loader = new ConfigLoader(schema, [new ProcessEnvSource()]);
 * const config = await loader.load();
 * ```
 */
export class ZodConfigSchema<T> implements ConfigSchema<T> {
  constructor(private readonly schema: ZodType<T>) {}

  validate(raw: Record<string, string | undefined>): ReturnType<ConfigSchema<T>['validate']> {
    const parsed = this.schema.safeParse(raw);
    if (parsed.success) return Result.ok(parsed.data);
    const errors: string[] = parsed.error.issues.map(
      (issue: { path: (string | number)[]; message: string }) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '_root';
        return `${path}: ${issue.message}`;
      },
    );
    return Result.err(errors);
  }
}
