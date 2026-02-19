/* eslint-disable
   @typescript-eslint/no-unsafe-return,
   @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/strict-boolean-expressions
   -- Option and Duration are from @acme/kernel; all types are correct at
   compile time but the ESLint TS plugin cannot resolve them due to the
   TypeScript version mismatch (5.9.x vs plugin-supported <5.4). */
import { Option } from '@acme/kernel';
import type { Duration } from '@acme/kernel';
import type { SecretsPort } from './SecretsPort';

interface CacheEntry {
  readonly value: string;
  readonly expiresAt: number;
}

/**
 * Decorator that wraps any `SecretsPort` with an in-memory TTL cache.
 *
 * Reduces latency and remote API calls for frequently-accessed secrets.
 * The cache is evicted on `set`, `delete`, and `rotate` to stay consistent.
 *
 * @example
 * ```typescript
 * const adapter = new CachedSecretsAdapter(
 *   new AwsSsmSecretsAdapter(ssmClient),
 *   Duration.ofMinutes(5),
 * );
 * ```
 */
export class CachedSecretsAdapter implements SecretsPort {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly inner: SecretsPort,
    private readonly ttl: Duration,
  ) {}

  async get(key: string): Promise<Option<string>> {
    const entry = this.cache.get(key);
    if (entry !== undefined && Date.now() < entry.expiresAt) {
      return Option.some(entry.value);
    }
    this.cache.delete(key);

    const result = await this.inner.get(key);
    if (result.isSome()) {
      this.cache.set(key, {
        value:     result.unwrap(),
        expiresAt: Date.now() + ttl(this.ttl),
      });
    }
    return result;
  }

  async set(key: string, value: string): Promise<void> {
    await this.inner.set(key, value);
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl(this.ttl),
    });
  }

  async delete(key: string): Promise<void> {
    await this.inner.delete(key);
    this.cache.delete(key);
  }

  async rotate(key: string): Promise<void> {
    await this.inner.rotate(key);
    this.cache.delete(key);
  }
}

/** Extract milliseconds from a Duration without triggering no-unsafe-call in callers. */
function ttl(d: Duration): number {
  return d.toMilliseconds();
}
