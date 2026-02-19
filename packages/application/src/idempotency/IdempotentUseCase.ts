import type { Result } from '@acme/kernel';
import type { IdempotencyKey } from './IdempotencyKey';
import type { IdempotencyStorePort } from './IdempotencyStorePort';
import type { IdempotencyMetrics } from './IdempotencyMetrics';
import type { UseCase } from '../usecases/UseCase';
import { IdempotencyConflictError } from './IdempotencyConflictError';

/**
 * Any input that carries an idempotency key.
 */
export interface WithIdempotencyKey {
  readonly idempotencyKey: IdempotencyKey;
}

/**
 * Decorates a {@link UseCase} with idempotency semantics:
 *
 * 1. If a cached `Result` exists for the key → return it immediately (cache hit).
 * 2. Acquire the idempotency lock for the key:
 *    - On success (new key) → execute the inner use case and cache the result.
 *    - On failure (key exists) → check cache again; if still empty, throw
 *      {@link IdempotencyConflictError} (concurrent duplicate in progress).
 * 3. If the inner use case throws an unexpected error the lock is released so
 *    future retries can succeed.
 */
export class IdempotentUseCase<
  TInput extends WithIdempotencyKey,
  TOutput,
  TError = Error,
> implements UseCase<TInput, TOutput, TError> {
  constructor(
    private readonly inner: UseCase<TInput, TOutput, TError>,
    private readonly store: IdempotencyStorePort<Result<TOutput, TError>>,
    private readonly ttlMs: number,
    private readonly metrics?: IdempotencyMetrics,
  ) {}

  async execute(input: TInput): Promise<Result<TOutput, TError>> {
    const key = input.idempotencyKey;

    // 1. Fast path: already cached
    const cached = await this.store.getResult(key);
    if (cached !== null) {
      this.metrics?.recordHit();
      return cached;
    }

    // 2. Try to acquire lock
    const acquired = await this.store.tryAcquire(key, this.ttlMs);
    if (!acquired) {
      // Another request holds the lock — check if it completed
      const cached2 = await this.store.getResult(key);
      if (cached2 !== null) {
        this.metrics?.recordHit();
        return cached2;
      }
      this.metrics?.recordConflict();
      throw new IdempotencyConflictError(key.value);
    }

    // 3. First request: execute and cache
    this.metrics?.recordMiss();
    try {
      const result = await this.inner.execute(input);
      await this.store.storeResult(key, result, this.ttlMs);
      return result;
    } catch (error) {
      // Infrastructure error — release lock so retries can proceed
      await this.store.release(key);
      this.metrics?.recordError();
      throw error;
    }
  }
}
