import type { ProcessState, ProcessStatus, ProcessStore } from './types.js';

/**
 * In-memory implementation of ProcessStore.
 * Reads and secondary indices return deep copies via structuredClone.
 */
export class InMemoryProcessStore<TState = unknown> implements ProcessStore<TState> {
  private readonly byId = new Map<string, ProcessState<TState>>();
  private readonly byCorrelation = new Map<string, string>(); // correlationId → processId

  save(state: ProcessState<TState>): Promise<void> {
    const clone = structuredClone(state);

    // Update correlation index
    if (state.correlationId !== undefined) {
      this.byCorrelation.set(state.correlationId, state.id);
    }

    this.byId.set(state.id, clone);
    return Promise.resolve();
  }

  findById(id: string): Promise<ProcessState<TState> | undefined> {
    const s = this.byId.get(id);
    return Promise.resolve(s !== undefined ? structuredClone(s) : undefined);
  }

  findByCorrelationId(correlationId: string): Promise<ProcessState<TState> | undefined> {
    const id = this.byCorrelation.get(correlationId);
    if (id === undefined) return Promise.resolve(undefined);
    return this.findById(id);
  }

  findByStatus(status: ProcessStatus): Promise<ProcessState<TState>[]> {
    const results: ProcessState<TState>[] = [];
    for (const s of this.byId.values()) {
      if (s.status === status) {
        results.push(structuredClone(s));
      }
    }
    return Promise.resolve(results);
  }

  delete(id: string): Promise<void> {
    const s = this.byId.get(id);
    if (s?.correlationId !== undefined) {
      this.byCorrelation.delete(s.correlationId);
    }
    this.byId.delete(id);
    return Promise.resolve();
  }

  size(): number {
    return this.byId.size;
  }
}
