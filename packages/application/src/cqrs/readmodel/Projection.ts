import type { ProjectedEvent, ReadModel, ReadModelStore } from './types.js';

/**
 * Interface every projection must implement.
 */
export interface Projection {
  readonly name: string;
  project(event: ProjectedEvent): Promise<void>;
  reset(): Promise<void>;
}

/**
 * Abstract base projection that delegates state storage to a ReadModelStore.
 */
export abstract class BaseProjection<TState extends ReadModel = ReadModel> implements Projection {
  abstract readonly name: string;

  constructor(protected readonly store: ReadModelStore<TState>) {}

  abstract project(event: ProjectedEvent): Promise<void>;

  async reset(): Promise<void> {
    const all = await this.store.findAll();
    for (const model of all) {
      await this.store.delete(model.id);
    }
  }
}
