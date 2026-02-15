import type { IdempotencyStorePort } from '@acme/application';
import type { IdempotencyKey } from '@acme/application';

export class InMemoryIdempotencyStore<T = unknown> implements IdempotencyStorePort<T> {
  private locks = new Map<string, { result?: T; expiresAt: number }>();

  async tryAcquire(key: IdempotencyKey, ttlMs: number): Promise<boolean> {
    const existing = this.locks.get(key.value);

    if (existing && existing.expiresAt > Date.now()) {
      return Promise.resolve(false);
    }

    this.locks.set(key.value, { expiresAt: Date.now() + ttlMs });
    return Promise.resolve(true);
  }

  async getResult(key: IdempotencyKey): Promise<T | null> {
    const entry = this.locks.get(key.value);
    return Promise.resolve(entry?.result ?? null);
  }

  async storeResult(key: IdempotencyKey, result: T, ttlMs: number): Promise<void> {
    this.locks.set(key.value, { result, expiresAt: Date.now() + ttlMs });
    return Promise.resolve();
  }

  async release(key: IdempotencyKey): Promise<void> {
    this.locks.delete(key.value);
    return Promise.resolve();
  }

  clear(): void {
    this.locks.clear();
  }
}
