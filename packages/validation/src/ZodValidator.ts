/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import { Result } from '@acme/kernel';
import type { ZodSchema } from 'zod';
import type { ValidationResult, Validator } from './Validator';
import { ValidationError } from './ValidationError';
import type { ValidationIssue } from './ValidationError';

/**
 * A {@link Validator} backed by a Zod schema.
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 *
 * const schema = z.object({
 *   email: z.string().email(),
 *   age:   z.number().min(18),
 * });
 *
 * const validator = new ZodValidator(schema);
 * const result = await validator.validate({ email: 'x', age: 15 });
 * // result.isErr() === true
 * ```
 */
export class ZodValidator<T> implements Validator<T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  validate(input: unknown): Promise<ValidationResult<T>> {
    const parsed = this.schema.safeParse(input);

    if (parsed.success) {
      return Promise.resolve(Result.ok<T, ValidationError>(parsed.data));
    }

    const issues: ValidationIssue[] = parsed.error.issues.map((issue) => {
      const field = issue.path.length > 0 ? issue.path.join('.') : '_root';
      const base: Record<string, unknown> = { field, message: issue.message, code: issue.code };
      return base as unknown as ValidationIssue;
    });

    return Promise.resolve(Result.err<T, ValidationError>(new ValidationError(issues)));
  }
}
