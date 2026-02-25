import type { PipelineBehavior, CacheEntry } from '../types.js';

/**
 * Pipeline behavior that caches handler responses by a key derived from the request.
 * Ordered at 30 — runs after logging and validation.
 *
 * @param keyFn  Derives a string cache key from the request.
 * @param ttlMs  Optional time-to-live in milliseconds. Stale entries are evicted on read.
 */
export class CachingBehavior<TRequest = unknown, TResponse = unknown> implements PipelineBehavior<
  TRequest,
  TResponse
> {
  readonly order = 30;

  private readonly cache = new Map<string, CacheEntry<TResponse>>();

  constructor(
    private readonly keyFn: (request: TRequest) => string,
    private readonly ttlMs?: number,
  ) {}

  async handle(request: TRequest, next: () => Promise<TResponse>): Promise<TResponse> {
    const key = this.keyFn(request);
    const entry = this.cache.get(key);

    if (entry !== undefined && !this.isStale(entry)) {
      return entry.value;
    }

    const value = await next();
    this.cache.set(key, { value, cachedAt: new Date(), ttlMs: this.ttlMs });
    return value;
  }

  private isStale(entry: CacheEntry<TResponse>): boolean {
    const ttl = entry.ttlMs ?? this.ttlMs;
    if (ttl === undefined) return false;
    return Date.now() - entry.cachedAt.getTime() > ttl;
  }

  /** Remove a specific entry from the cache. */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /** Remove all cached entries. */
  clear(): void {
    this.cache.clear();
  }

  /** Number of currently cached entries. */
  size(): number {
    return this.cache.size;
  }

  /** True if the given key has a non-stale cached value. */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isStale(entry);
  }
}
