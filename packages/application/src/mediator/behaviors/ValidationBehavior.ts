import type { PipelineBehavior } from '../types.js';

/**
 * Thrown when a request fails pipeline validation.
 */
export class MediatorValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Validation failed: ${errors.join(', ')}`);
    this.name = 'MediatorValidationError';
  }
}

/**
 * Pipeline behavior that validates the incoming request before forwarding it.
 * Ordered at 20 — runs after logging but before any domain logic.
 *
 * @param validate  Function that returns an array of error messages.
 *                  An empty array (or undefined return) means the request is valid.
 */
export class ValidationBehavior<
  TRequest = unknown,
  TResponse = unknown,
> implements PipelineBehavior<TRequest, TResponse> {
  readonly order = 20;

  constructor(private readonly validate: (request: TRequest) => string[]) {}

  async handle(request: TRequest, next: () => Promise<TResponse>): Promise<TResponse> {
    const errors = this.validate(request);
    if (errors.length > 0) {
      throw new MediatorValidationError(errors);
    }
    return next();
  }
}
