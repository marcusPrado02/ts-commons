/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Result } from '@acme/kernel';
import type { ValidationResult, Validator } from './Validator';
import type { ValidationIssue } from './ValidationError';
import { ValidationError } from './ValidationError';

/**
 * Runs multiple validators against the same input and aggregates all issues.
 * Returns `Ok` only if every validator succeeds.
 *
 * @example
 * ```ts
 * const composite = new CompositeValidator(zodValidator, businessRuleValidator);
 * const result = await composite.validate(input);
 * ```
 */
export class CompositeValidator<T> implements Validator<T> {
  private readonly validators: ReadonlyArray<Validator<T>>;

  constructor(...validators: Validator<T>[]) {
    this.validators = validators;
  }

  async validate(input: unknown): Promise<ValidationResult<T>> {
    const allIssues: ValidationIssue[] = [];
    let lastValue: T | undefined;

    for (const validator of this.validators) {
      const result = await validator.validate(input);
      result.match({
        ok: (value) => {
          lastValue = value;
        },
        err: (err) => {
          allIssues.push(...err.issues);
        },
      });
    }

    if (allIssues.length > 0) {
      return Result.err<T, ValidationError>(new ValidationError(allIssues));
    }

    return Result.ok<T, ValidationError>(lastValue as T);
  }
}

/**
 * A validator built from a plain predicate function — useful for
 * business-rule validation without a schema library.
 *
 * @example
 * ```ts
 * const ageValidator = new FunctionValidator<{ age: number }>(
 *   (input) => {
 *     const obj = input as { age: number };
 *     return obj.age >= 18 ? obj : null;
 *   },
 *   'age',
 *   'Must be at least 18',
 * );
 * ```
 */
export class FunctionValidator<T> implements Validator<T> {
  constructor(
    private readonly fn: (input: unknown) => T | null,
    private readonly field: string,
    private readonly message: string,
    private readonly code?: string,
  ) {}

  validate(input: unknown): Promise<ValidationResult<T>> {
    const result = this.fn(input);
    if (result !== null) {
      return Promise.resolve(Result.ok<T, ValidationError>(result));
    }
    return Promise.resolve(
      Result.err<T, ValidationError>(ValidationError.fromMessage(this.field, this.message, this.code)),
    );
  }
}
