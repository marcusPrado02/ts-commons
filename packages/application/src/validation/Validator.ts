import type { Result } from '@acme/kernel';
import type { ValidationError } from './ValidationError';

/**
 * Validator interface for input validation.
 */
export interface Validator<T> {
  validate(input: T): Promise<Result<T, ValidationError>>;
}
