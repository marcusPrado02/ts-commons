/**
 * Validation error with field-level errors.
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: ValidationFieldError[],
  ) {
    super(message);
    this.name = 'ValidationError';
  }

  static single(field: string, message: string): ValidationError {
    return new ValidationError('Validation failed', [{ field, message }]);
  }
}

export interface ValidationFieldError {
  readonly field: string;
  readonly message: string;
  readonly code?: string;
}
