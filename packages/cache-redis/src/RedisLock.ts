/**
 * Distributed lock adapter backed by Redis.
 *
 * Uses the atomic SET key value NX PX ttl pattern to guarantee that only one
 * caller can hold the lock at any given time.
 */
import type { RedisClientLike } from './RedisClientLike';

/**
 * Error thrown when a lock cannot be acquired because it is already held.
 */
export class RedisLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisLockError';
  }
}

/**
 * Single-key distributed lock backed by Redis.
 *
 * Uses the idiomatic `SET key value NX PX ttlMs` pattern so that:
 * - Only the first caller acquires the lock (NX = set-if-not-exists).
 * - The lock is automatically released after `ttlMs` even if the holder crashes.
 *
 * @example
 * ```typescript
 * const lock = new RedisLock(redisClient);
 *
 * // Low-level acquire / release
 * const lockValue = crypto.randomUUID();
 * const acquired = await lock.acquire('payment:42', lockValue, 5_000);
 * if (acquired) {
 *   try { await processPayment(); }
 *   finally { await lock.release('payment:42'); }
 * }
 *
 * // High-level helper
 * await lock.withLock('payment:42', async () => {
 *   await processPayment();
 * });
 * ```
 */
export class RedisLock {
  private static readonly DEFAULT_TTL_MS = 30_000;

  constructor(
    private readonly client: RedisClientLike,
    private readonly defaultTtlMs: number = RedisLock.DEFAULT_TTL_MS,
  ) {}

  /**
   * Attempt to acquire the lock.
   *
   * @param lockKey  - Unique Redis key for this lock (e.g. `'lock:payment:42'`).
   * @param lockValue - Unique value that identifies the lock holder.
   *                    Use `crypto.randomUUID()` to guarantee uniqueness.
   * @param ttlMs    - Lock TTL in milliseconds. Defaults to `defaultTtlMs`.
   * @returns `true` if the lock was acquired, `false` if it is already held.
   */
  async acquire(lockKey: string, lockValue: string, ttlMs?: number): Promise<boolean> {
    const result = await this.client.set(lockKey, lockValue, 'NX', 'PX', ttlMs ?? this.defaultTtlMs);
    return result === 'OK';
  }

  /**
   * Release the lock by deleting its key.
   *
   * > ⚠️ Production implementations should compare the stored value before
   * >   deleting (Lua script) to avoid releasing another holder's lock.
   * >   This implementation is intentionally simple for library use.
   */
  async release(lockKey: string): Promise<void> {
    await this.client.del(lockKey);
  }

  /**
   * Execute `work` while holding the lock.
   * Releases the lock in a `finally` block even if `work` throws.
   *
   * @throws {RedisLockError} when the lock cannot be acquired.
   */
  async withLock<T>(lockKey: string, work: () => Promise<T>, ttlMs?: number): Promise<T> {
    const lockValue = `${lockKey}-${Date.now().toString()}`;
    const acquired = await this.acquire(lockKey, lockValue, ttlMs);
    if (!acquired) {
      throw new RedisLockError(`Could not acquire lock: ${lockKey}`);
    }
    try {
      return await work();
    } finally {
      await this.release(lockKey);
    }
  }
}
