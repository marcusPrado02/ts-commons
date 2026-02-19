import type { Result } from '@acme/kernel';
import type { ValidationError } from './ValidationError';

/**
 * Alias for a Result that carries a validation error on failure.
 */
export type ValidationResult<T> = Result<T, ValidationError>;

/**
 * Port (interface) for validators.
 * Validate unknown input and return a typed, validated value on success.
 *
 * @example
 * ```ts
 * const validator: Validator<CreateUserDto> = new ZodValidator(createUserSchema);
 * const result = await validator.validate(req.body);
 * if (result.isOk()) { ... }
 * ```
 */
export interface Validator<T> {
  validate(input: unknown): Promise<ValidationResult<T>>;
}
