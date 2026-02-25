import type { ReadModel, ReadModelStore } from './types.js';

/**
 * In-memory implementation of ReadModelStore.
 * Every read/write returns a shallow copy to prevent external mutation.
 */
export class InMemoryReadModelStore<T extends ReadModel> implements ReadModelStore<T> {
  private readonly map = new Map<string, T>();

  save(model: T): Promise<void> {
    this.map.set(model.id, { ...model });
    return Promise.resolve();
  }

  findById(id: string): Promise<T | undefined> {
    const model = this.map.get(id);
    return Promise.resolve(model !== undefined ? { ...model } : undefined);
  }

  findAll(): Promise<T[]> {
    return Promise.resolve(Array.from(this.map.values()).map((m) => ({ ...m })));
  }

  delete(id: string): Promise<void> {
    this.map.delete(id);
    return Promise.resolve();
  }

  size(): number {
    return this.map.size;
  }
}
