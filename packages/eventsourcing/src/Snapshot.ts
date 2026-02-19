/**
 * A point-in-time snapshot of an aggregate's state.
 * Snapshots allow skipping event replay from the beginning of history.
 *
 * @template TState  The serialisable state type of the aggregate.
 */
export interface Snapshot<TState = unknown> {
  /** The aggregate identifier this snapshot belongs to. */
  readonly aggregateId: string;
  /** The event version at which this snapshot was taken. */
  readonly version: number;
  /** The full serialised state of the aggregate. */
  readonly state: TState;
  /** When the snapshot was created. */
  readonly timestamp: Date;
}

/**
 * Abstraction for storing and loading aggregate snapshots.
 */
export interface SnapshotStore {
  /** Persists a snapshot, replacing any previous snapshot for the same aggregate. */
  save<TState>(snapshot: Snapshot<TState>): Promise<void>;
  /** Returns the latest snapshot for the given aggregate id, or `undefined`. */
  get<TState>(aggregateId: string): Promise<Snapshot<TState> | undefined>;
}

/**
 * In-memory {@link SnapshotStore} for testing and local development.
 */
export class InMemorySnapshotStore implements SnapshotStore {
  private readonly store = new Map<string, Snapshot<unknown>>();

  save<TState>(snapshot: Snapshot<TState>): Promise<void> {
    this.store.set(snapshot.aggregateId, snapshot as Snapshot<unknown>);
    return Promise.resolve();
  }

  get<TState>(aggregateId: string): Promise<Snapshot<TState> | undefined> {
    return Promise.resolve(this.store.get(aggregateId) as Snapshot<TState> | undefined);
  }
}
