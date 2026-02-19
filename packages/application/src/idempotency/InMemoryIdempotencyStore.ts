import type { IdempotencyKey } from './IdempotencyKey';
import type { IdempotencyStorePort } from './IdempotencyStorePort';

interface StoreEntry<T> {
  result: T | null;
  expiresAt: number;
}

/**
 * In-memory implementation of {@link IdempotencyStorePort}.
 *
 * Stores entries in a `Map<string, StoreEntry>` with TTL-based expiry.
 * Intended for local development, tests, and single-process environments.
 * Use a Redis-backed store for distributed deployments.
 */
export class InMemoryIdempotencyStore<T> implements IdempotencyStorePort<T> {
  private readonly store = new Map<string, StoreEntry<T>>();

  /**
   * Attempts to acquire an idempotency lock for `key`.
   * Returns `true` if the lock is newly created (first request).
   * Returns `false` if the key already exists and has not yet expired.
   * Expired entries are evicted before checking.
   */
  tryAcquire(key: IdempotencyKey, ttlMs: number): Promise<boolean> {
    this.evictExpired();
    const k = key.value;

    if (this.store.has(k)) {
      return Promise.resolve(false);
    }

    this.store.set(k, { result: null, expiresAt: Date.now() + ttlMs });
    return Promise.resolve(true);
  }

  /**
   * Returns the stored result for `key`, or `null` if none exists or entry expired.
   */
  getResult(key: IdempotencyKey): Promise<T | null> {
    const entry = this.store.get(key.value);

    if (entry === undefined || Date.now() > entry.expiresAt) {
      return Promise.resolve(null);
    }

    return Promise.resolve(entry.result);
  }

  /**
   * Associates `result` with `key`, resetting the TTL.
   */
  storeResult(key: IdempotencyKey, result: T, ttlMs: number): Promise<void> {
    const k = key.value;
    const entry = this.store.get(k);

    if (entry !== undefined) {
      entry.result = result;
      entry.expiresAt = Date.now() + ttlMs;
    } else {
      this.store.set(k, { result, expiresAt: Date.now() + ttlMs });
    }

    return Promise.resolve();
  }

  /**
   * Releases (deletes) the entry for `key`.
   * Called on error to allow subsequent retries.
   */
  release(key: IdempotencyKey): Promise<void> {
    this.store.delete(key.value);
    return Promise.resolve();
  }

  /**
   * Removes all expired entries and returns the number of entries removed.
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [k, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(k);
        removed++;
      }
    }

    return removed;
  }

  /** Returns the current number of tracked entries (including locked ones). */
  size(): number {
    return this.store.size;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [k, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(k);
      }
    }
  }
}
