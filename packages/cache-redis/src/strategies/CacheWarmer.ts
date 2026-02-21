import type { Duration } from '@acme/kernel';
import type { CachePort } from './CachePort';

export interface WarmupItem {
  key: string;
  value: unknown;
  ttl?: Duration;
}

export interface WarmupResult {
  name: string;
  itemCount: number;
  durationMs: number;
}

/** A function that produces cache entries to pre-populate. */
export type WarmFn = () => Promise<WarmupItem[]>;

/**
 * Registers and executes named cache warming strategies.
 *
 * Warming pre-populates the cache before live traffic arrives, reducing
 * cold-start latency spikes. Each warmer is a named async function that
 * returns key-value pairs to write into the cache.
 *
 * @example
 * ```typescript
 * const warmer = new CacheWarmer(cache);
 *
 * warmer.register('hot-products', async () => {
 *   const products = await db.findTopProducts(50);
 *   return products.map((p) => ({ key: `product:${p.id}`, value: p }));
 * });
 *
 * await warmer.warmAll();
 * ```
 */
export class CacheWarmer {
  private readonly warmers = new Map<string, WarmFn>();

  constructor(private readonly cache: CachePort) {}

  /** Register a named warming function; replaces any existing registration. */
  register(name: string, fn: WarmFn): void {
    this.warmers.set(name, fn);
  }

  /** Remove a named warming function. */
  unregister(name: string): void {
    this.warmers.delete(name);
  }

  /** Return `true` if a warmer with the given name is registered. */
  has(name: string): boolean {
    return this.warmers.has(name);
  }

  /** Total number of registered warmers. */
  warmerCount(): number {
    return this.warmers.size;
  }

  /** Run a single named warmer and return stats. */
  async warm(name: string): Promise<WarmupResult> {
    const fn = this.warmers.get(name);
    if (fn === undefined) {
      throw new Error(`No warmer registered with name "${name}"`);
    }
    const start = Date.now();
    const items = await fn();
    await this.writeItems(items);
    return { name, itemCount: items.length, durationMs: Date.now() - start };
  }

  /** Run all registered warmers sequentially and return stats per warmer. */
  async warmAll(): Promise<WarmupResult[]> {
    const results: WarmupResult[] = [];
    for (const name of this.warmers.keys()) {
      results.push(await this.warm(name));
    }
    return results;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async writeItems(items: WarmupItem[]): Promise<void> {
    for (const item of items) {
      await this.cache.set(item.key, item.value, item.ttl);
    }
  }
}
