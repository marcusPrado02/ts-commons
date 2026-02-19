/**
 * Thrown when an operation for a given idempotency key is already in progress
 * and no cached result is available yet.
 */
export class IdempotencyConflictError extends Error {
  readonly idempotencyKey: string;

  constructor(key: string) {
    super(`Idempotency conflict: operation for key "${key}" is already in progress`);
    this.name = 'IdempotencyConflictError';
    this.idempotencyKey = key;
  }
}
