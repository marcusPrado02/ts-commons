import { Result } from '@acme/kernel';

/**
 * Schema for validating configuration.
 */
export interface ConfigSchema<T> {
  validate(raw: Record<string, string | undefined>): Result<T, string[]>;
}
