import { DomainError } from './DomainError';

/**
 * Error thrown when an entity is not found.
 */
export class NotFoundError extends DomainError {
  constructor(
    public readonly entityName: string,
    public readonly entityId: string,
  ) {
    super(`${entityName} with id ${entityId} not found`, 'NOT_FOUND');
  }
}
