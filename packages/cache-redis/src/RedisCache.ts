/**
 * Cache adapter backed by Redis.
 *
 * Values are JSON-serialized on write and deserialized on read so any
 * JSON-compatible domain type can be stored without separate serialization code.
 */
/* eslint-disable
   @typescript-eslint/no-unsafe-return,
   @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-argument
   -- this file straddles the JSON.parse any-boundary; all values are constrained
   by the caller's generic parameter <T>. Option/Duration type inference is
   correct at compile time but unresolvable by the ESLint TS plugin due to the
   TypeScript version mismatch (5.9.x vs plugin-supported <5.4). */
import { Option } from '@acme/kernel';
import type { Duration } from '@acme/kernel';
import type { RedisClientLike } from './RedisClientLike';

/**
 * Generic Redis cache with `Option<T>` semantics for reads.
 *
 * @example
 * ```typescript
 * const cache = new RedisCache(redisClient);
 *
 * await cache.set('user:1', user, Duration.ofMinutes(15));
 * const hit = await cache.get<User>('user:1');
 *
 * hit.match({
 *   some: (u) => console.log('cached', u),
 *   none: () => console.log('cache miss'),
 * });
 * ```
 */
export class RedisCache {
  constructor(private readonly client: RedisClientLike) {}

  /**
   * Retrieve a cached value.
   * Returns `Option.some(value)` on a cache hit and `Option.none()` on a miss.
   */
  async get<T>(key: string): Promise<Option<T>> {
    const raw = await this.client.get(key);
    if (raw === null) return Option.none<T>();
    return Option.some(JSON.parse(raw) as T);
  }

  /**
   * Store a value in the cache.
   *
   * @param key  - Cache key.
   * @param value - Any JSON-serializable value.
   * @param ttl  - Optional time-to-live (uses PX for millisecond precision).
   *               If omitted the entry is stored without an expiry.
   */
  async set<T>(key: string, value: T, ttl?: Duration): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl === undefined) {
      await this.client.set(key, serialized);
    } else {
      await this.client.set(key, serialized, 'PX', ttl.toMilliseconds());
    }
  }

  /**
   * Remove an entry from the cache.
   * No-op if the key does not exist.
   */
  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Return `true` if the given key exists in the cache.
   */
  async has(key: string): Promise<boolean> {
    const count = await this.client.exists(key);
    return count > 0;
  }

  /**
   * Return all cache keys matching a glob pattern.
   *
   * @example `cache.keys('user:*')` returns all user cache keys.
   *
   * > ⚠️ Use `SCAN` iteration in production for large key spaces;
   * >   `KEYS` blocks the server while scanning.
   */
  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }
}
