/* eslint-disable @typescript-eslint/no-floating-promises -- queueMicrotask intentionally schedules flush without awaiting */
/**
 * Generic DataLoader — batches individual key lookups into a single batch call.
 *
 * Concurrent calls to `load(key)` within the same microtask tick are coalesced
 * into one `batchFn` invocation, eliminating N+1 query patterns.
 *
 * @example
 * ```typescript
 * const userLoader = new DataLoader<string, User>(async (ids) => {
 *   const rows = await db.query('SELECT * FROM users WHERE id = ANY($1)', [ids]);
 *   return new Map(rows.map((r) => [r.id, r]));
 * });
 *
 * // These three calls are batched into a single DB query:
 * const [u1, u2, u3] = await Promise.all([
 *   userLoader.load('1'),
 *   userLoader.load('2'),
 *   userLoader.load('3'),
 * ]);
 * ```
 */
export class DataLoader<K, V> {
  private readonly cache = new Map<K, Promise<V | null>>();
  private readonly queue: Array<{
    key: K;
    resolve: (v: V | null) => void;
    reject: (e: unknown) => void;
  }> = [];
  private scheduled = false;

  /**
   * @param batchFn - Receives an array of keys and returns a Map of key → value.
   *                  Keys absent from the map are treated as "not found" (null).
   */
  constructor(private readonly batchFn: (keys: readonly K[]) => Promise<Map<K, V>>) {}

  /** Load a single value by key. Results are cached for the lifetime of the loader. */
  load(key: K): Promise<V | null> {
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const pending = this.enqueue(key);
    this.cache.set(key, pending);
    this.scheduleBatch();
    return pending;
  }

  /** Remove a key from the result cache. Next `load` call will re-fetch. */
  clear(key: K): void {
    this.cache.delete(key);
  }

  /** Remove all cached values. */
  clearAll(): void {
    this.cache.clear();
  }

  /** Pre-seed the cache with a known value; avoids a batch call for that key. */
  prime(key: K, value: V): void {
    this.cache.set(key, Promise.resolve(value));
  }

  /** Number of keys currently cached (resolved or pending). */
  cacheSize(): number {
    return this.cache.size;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private enqueue(key: K): Promise<V | null> {
    return new Promise<V | null>((resolve, reject) => {
      this.queue.push({ key, resolve, reject });
    });
  }

  private scheduleBatch(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.flush();
    });
  }

  private flush(): void {
    const items = this.queue.splice(0);
    this.scheduled = false;
    if (items.length === 0) return;
    const keys = items.map((i): K => i.key);
    this.batchFn(keys)
      .then((results): void => {
        for (const item of items) {
          item.resolve(results.get(item.key) ?? null);
        }
      })
      .catch((err: unknown): void => {
        for (const item of items) {
          item.reject(err);
        }
      });
  }
}
