/**
 * Base class for domain errors.
 * Domain errors represent business rule violations.
 */
export abstract class DomainError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
