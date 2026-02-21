import { Option } from '@acme/kernel';
import type { Duration } from '@acme/kernel';
import type { CachePort } from './CachePort';

interface CacheEntry {
  value: unknown;
  expiresAt: number | undefined;
}

export interface InMemoryCacheOptions {
  /** Maximum number of entries to keep; oldest entry is evicted when full. */
  maxSize?: number;
}

/**
 * In-memory L1 cache with optional TTL and FIFO eviction.
 *
 * Suitable as a fast local tier in multi-level caching architectures.
 * All methods comply with the {@link CachePort} interface so instances can be
 * swapped with any other cache implementation.
 */
export class InMemoryCache implements CachePort {
  private readonly store = new Map<string, CacheEntry>();
  private readonly maxEntries: number;

  constructor(options?: InMemoryCacheOptions) {
    this.maxEntries = options?.maxSize ?? 1000;
  }

  get<T>(key: string): Promise<Option<T>> {
    return Promise.resolve(this.getSync<T>(key));
  }

  set<T>(key: string, value: T, ttl?: Duration): Promise<void> {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      this.evictOldest();
    }
    const expiresAt = ttl !== undefined ? Date.now() + ttl.toMilliseconds() : undefined;
    this.store.set(key, { value, expiresAt });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  has(key: string): Promise<boolean> {
    const option = this.getSync(key);
    return Promise.resolve(option.isSome());
  }

  /** Current number of stored entries (includes lazily-stale entries). */
  size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  private getSync<T>(key: string): Option<T> {
    const entry = this.store.get(key);
    if (entry === undefined) return Option.none<T>();
    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return Option.none<T>();
    }
    return Option.some(entry.value as T);
  }

  private evictOldest(): void {
    const firstKey = this.store.keys().next().value;
    if (firstKey !== undefined) {
      this.store.delete(firstKey);
    }
  }
}
