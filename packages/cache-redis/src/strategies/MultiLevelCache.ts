import type { Option } from '@acme/kernel';
import type { Duration } from '@acme/kernel';
import type { CachePort } from './CachePort';

/**
 * Two-tier cache: L1 (fast, in-memory) backed by L2 (remote, e.g. Redis).
 *
 * Read path: L1 hit → return; L1 miss → read L2 and populate L1.
 * Write path: write to both tiers atomically.
 * Stampede prevention: concurrent `getOrCompute` calls for the same key share
 * a single in-flight computation via a promise lock.
 */
export class MultiLevelCache implements CachePort {
  /** In-flight computations keyed by cache key (stampede prevention). */
  private readonly inflight = new Map<string, Promise<void>>();

  constructor(
    private readonly l1: CachePort,
    private readonly l2: CachePort,
  ) {}

  async get<T>(key: string): Promise<Option<T>> {
    const l1Result = await this.l1.get<T>(key);
    if (l1Result.isSome()) return l1Result;
    return this.fetchFromL2<T>(key);
  }

  /** Get from cache; on miss, compute the value exactly once (stampede-safe). */
  async getOrCompute<T>(key: string, fn: () => Promise<T>, ttl?: Duration): Promise<T> {
    const existing = await this.get<T>(key);
    if (existing.isSome()) return existing.unwrap();
    return this.computeWithLock<T>(key, fn, ttl);
  }

  async set<T>(key: string, value: T, ttl?: Duration): Promise<void> {
    await Promise.all([this.l1.set(key, value, ttl), this.l2.set(key, value, ttl)]);
  }

  async delete(key: string): Promise<void> {
    await Promise.all([this.l1.delete(key), this.l2.delete(key)]);
  }

  async has(key: string): Promise<boolean> {
    const l1Has = await this.l1.has(key);
    if (l1Has) return true;
    return this.l2.has(key);
  }

  /** Evict from L1 only; L2 remains populated (useful after targeted writes). */
  async invalidateL1(key: string): Promise<void> {
    await this.l1.delete(key);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async fetchFromL2<T>(key: string): Promise<Option<T>> {
    const l2Result = await this.l2.get<T>(key);
    if (l2Result.isSome()) {
      await this.l1.set(key, l2Result.unwrap());
    }
    return l2Result;
  }

  private async computeWithLock<T>(key: string, fn: () => Promise<T>, ttl?: Duration): Promise<T> {
    const lock = this.inflight.get(key);
    if (lock !== undefined) {
      await lock;
      return this.getAfterLock<T>(key, fn, ttl);
    }
    return this.runComputation<T>(key, fn, ttl);
  }

  private async getAfterLock<T>(key: string, fn: () => Promise<T>, ttl?: Duration): Promise<T> {
    const result = await this.get<T>(key);
    if (result.isSome()) return result.unwrap();
    return this.runComputation<T>(key, fn, ttl);
  }

  private async runComputation<T>(key: string, fn: () => Promise<T>, ttl?: Duration): Promise<T> {
    let resolveLock!: () => void;
    const lock = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.inflight.set(key, lock);
    try {
      const value = await fn();
      await this.set(key, value, ttl);
      return value;
    } finally {
      resolveLock();
      this.inflight.delete(key);
    }
  }
}
