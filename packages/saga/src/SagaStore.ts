import type { SagaState, SagaStatus } from './types';

export interface SagaStore {
  save(state: SagaState): Promise<void>;
  findById(id: string): Promise<SagaState | undefined>;
  findByStatus(status: SagaStatus): Promise<SagaState[]>;
  delete(id: string): Promise<void>;
}

export class InMemorySagaStore implements SagaStore {
  private readonly store = new Map<string, SagaState>();

  save(state: SagaState): Promise<void> {
    this.store.set(state.id, { ...state });
    return Promise.resolve();
  }

  findById(id: string): Promise<SagaState | undefined> {
    const state = this.store.get(id);
    return Promise.resolve(state !== undefined ? { ...state } : undefined);
  }

  findByStatus(status: SagaStatus): Promise<SagaState[]> {
    const results = [...this.store.values()]
      .filter((s) => s.status === status)
      .map((s) => ({ ...s }));
    return Promise.resolve(results);
  }

  delete(id: string): Promise<void> {
    this.store.delete(id);
    return Promise.resolve();
  }

  get size(): number {
    return this.store.size;
  }
}
