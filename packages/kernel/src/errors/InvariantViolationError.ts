import { DomainError } from './DomainError';

/**
 * Error thrown when a domain invariant is violated.
 */
export class InvariantViolationError extends DomainError {
  constructor(message: string, code?: string) {
    super(message, code ?? 'INVARIANT_VIOLATION');
  }
}
