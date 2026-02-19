import type { IdempotencyStorePort } from '@acme/application';
import type { IdempotencyKey } from '@acme/application';

export class InMemoryIdempotencyStore<T = unknown> implements IdempotencyStorePort<T> {
  private readonly locks = new Map<string, { result?: T; expiresAt: number }>();

  tryAcquire(key: IdempotencyKey, ttlMs: number): Promise<boolean> {
    const existing = this.locks.get(key.value);
    if (existing !== undefined && existing.expiresAt > Date.now()) {
      return Promise.resolve(false);
    }
    this.locks.set(key.value, { expiresAt: Date.now() + ttlMs });
    return Promise.resolve(true);
  }

  getResult(key: IdempotencyKey): Promise<T | null> {
    const entry = this.locks.get(key.value);
    return Promise.resolve(entry?.result ?? null);
  }

  storeResult(key: IdempotencyKey, result: T, ttlMs: number): Promise<void> {
    this.locks.set(key.value, { result, expiresAt: Date.now() + ttlMs });
    return Promise.resolve();
  }

  release(key: IdempotencyKey): Promise<void> {
    this.locks.delete(key.value);
    return Promise.resolve();
  }

  clear(): void {
    this.locks.clear();
  }
}
