import type { Snapshot, SnapshotStore } from './types.js';

/** Default interval (in versions) at which a snapshot should be taken. */
const DEFAULT_SNAPSHOT_INTERVAL = 10;

/**
 * In-memory implementation of SnapshotStore.
 * Stores all snapshots per aggregate, returning copies on read.
 */
export class InMemorySnapshotStore<TState = unknown> implements SnapshotStore<TState> {
  private readonly store = new Map<string, Snapshot<TState>[]>();

  save(snapshot: Snapshot<TState>): Promise<void> {
    if (!this.store.has(snapshot.aggregateId)) {
      this.store.set(snapshot.aggregateId, []);
    }
    this.store.get(snapshot.aggregateId)!.push(structuredClone(snapshot));
    return Promise.resolve();
  }

  findLatest(aggregateId: string): Promise<Snapshot<TState> | undefined> {
    const snaps = this.store.get(aggregateId);
    if (!snaps || snaps.length === 0) return Promise.resolve(undefined);
    const latest = snaps.reduce((a, b) => (a.version > b.version ? a : b));
    return Promise.resolve(structuredClone(latest));
  }

  findByVersion(aggregateId: string, version: number): Promise<Snapshot<TState> | undefined> {
    const snaps = this.store.get(aggregateId);
    const snap = snaps?.find((s) => s.version === version);
    return Promise.resolve(snap !== undefined ? structuredClone(snap) : undefined);
  }

  delete(aggregateId: string): Promise<void> {
    this.store.delete(aggregateId);
    return Promise.resolve();
  }

  /** Total number of snapshots across all aggregates. */
  size(): number {
    let total = 0;
    for (const snaps of this.store.values()) {
      total += snaps.length;
    }
    return total;
  }
}

/**
 * Returns true when a snapshot should be taken at the given aggregate version.
 * @param currentVersion  Current aggregate version after applying the latest event.
 * @param interval        How frequently to snapshot (default every 10 versions).
 */
export function shouldTakeSnapshot(
  currentVersion: number,
  interval = DEFAULT_SNAPSHOT_INTERVAL,
): boolean {
  return currentVersion > 0 && currentVersion % interval === 0;
}
