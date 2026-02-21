interface CacheEntry {
  value: unknown;
  expiresAt: number | undefined;
}

/**
 * Cache-aside wrapper for query results.
 *
 * Reduces redundant database queries by caching the results of expensive
 * read operations with optional TTL-based expiration.
 *
 * @example
 * ```typescript
 * const queryCache = new QueryResultCache();
 *
 * const user = await queryCache.execute(
 *   `user:${id}`,
 *   () => db.findUserById(id),
 *   60_000, // 60 seconds TTL
 * );
 * ```
 */
export class QueryResultCache {
  private readonly store = new Map<string, CacheEntry>();

  /**
   * Return the cached result for `key` if available and not expired;
   * otherwise execute `fn`, cache the result, and return it.
   *
   * @param key   - Cache key.
   * @param fn    - Factory that produces the value on a cache miss.
   * @param ttlMs - Optional time-to-live in milliseconds.
   */
  async execute<T>(key: string, fn: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.lookup<T>(key);
    if (cached !== undefined) return cached;
    const value = await fn();
    const expiresAt = ttlMs !== undefined ? Date.now() + ttlMs : undefined;
    this.store.set(key, { value, expiresAt });
    return value;
  }

  /** Remove a specific entry from the cache. */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /** Remove all entries whose keys start with `prefix`. */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /** Remove all cached entries. */
  clear(): void {
    this.store.clear();
  }

  /** Number of entries currently in the cache (includes lazily-stale entries). */
  size(): number {
    return this.store.size;
  }

  /** Return `true` if the key exists and has not expired. */
  has(key: string): boolean {
    return this.lookup(key) !== undefined;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private lookup<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }
}
