import type { IdempotencyKey } from './IdempotencyKey';

/**
 * Port for storing idempotency records.
 */
export interface IdempotencyStorePort<T = unknown> {
  /**
   * Try to acquire lock for this idempotency key.
   * Returns true if acquired (first time), false if already exists.
   */
  tryAcquire(key: IdempotencyKey, ttlMs: number): Promise<boolean>;

  /**
   * Get stored result for this idempotency key.
   */
  getResult(key: IdempotencyKey): Promise<T | null>;

  /**
   * Store result for this idempotency key.
   */
  storeResult(key: IdempotencyKey, result: T, ttlMs: number): Promise<void>;

  /**
   * Release lock (in case of error).
   */
  release(key: IdempotencyKey): Promise<void>;
}
