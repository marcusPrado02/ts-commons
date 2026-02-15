import { DomainError } from './DomainError';

/**
 * Error thrown when there is a conflict (e.g., optimistic locking).
 */
export class ConflictError extends DomainError {
  constructor(message: string, code?: string) {
    super(message, code ?? 'CONFLICT');
  }
}
