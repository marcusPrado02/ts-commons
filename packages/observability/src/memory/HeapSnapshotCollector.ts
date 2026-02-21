import type { HeapSnapshot, HeapDiff } from './MemoryTypes';

const MAX_SNAPSHOTS = 500;

/**
 * Collects and stores heap snapshots, computes diffs between consecutive
 * snapshots, and surfaces the snapshot with the highest heap usage.
 *
 * @example
 * ```typescript
 * const collector = new HeapSnapshotCollector();
 * const mem = process.memoryUsage();
 * collector.capture({
 *   capturedAt: new Date(),
 *   heapUsedBytes: mem.heapUsed,
 *   heapTotalBytes: mem.heapTotal,
 *   externalBytes: mem.external,
 *   arrayBuffersBytes: mem.arrayBuffers,
 * });
 * ```
 */
export class HeapSnapshotCollector {
  private readonly snapshots: HeapSnapshot[] = [];

  /** Store a snapshot. Oldest entry is dropped when the cap is reached. */
  capture(snapshot: HeapSnapshot): void {
    this.snapshots.push(snapshot);
    if (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots.shift();
    }
  }

  /** All stored snapshots in insertion order. */
  getAll(): HeapSnapshot[] {
    return [...this.snapshots];
  }

  /** Most recently stored snapshot, or `undefined` when empty. */
  latest(): HeapSnapshot | undefined {
    return this.snapshots.at(-1);
  }

  /** Snapshot with the highest `heapUsedBytes`, or `undefined` when empty. */
  peak(): HeapSnapshot | undefined {
    if (this.snapshots.length === 0) return undefined;
    return this.snapshots.reduce((max, s) => (s.heapUsedBytes > max.heapUsedBytes ? s : max));
  }

  snapshotCount(): number {
    return this.snapshots.length;
  }

  /**
   * Returns diffs between each consecutive pair of snapshots.
   * Returns an empty array when fewer than two snapshots exist.
   */
  diffs(): HeapDiff[] {
    if (this.snapshots.length < 2) return [];
    const result: HeapDiff[] = [];
    for (let i = 1; i < this.snapshots.length; i++) {
      const prev = this.snapshots[i - 1];
      const curr = this.snapshots[i];
      if (prev === undefined || curr === undefined) continue;
      result.push({
        from: prev.capturedAt,
        to: curr.capturedAt,
        heapDeltaBytes: curr.heapUsedBytes - prev.heapUsedBytes,
        externalDeltaBytes: curr.externalBytes - prev.externalBytes,
      });
    }
    return result;
  }

  /** Heap growth from the first to the last snapshot (0 when < 2 snapshots). */
  totalHeapGrowthBytes(): number {
    if (this.snapshots.length < 2) return 0;
    const first = this.snapshots[0];
    const last = this.snapshots.at(-1);
    if (first === undefined || last === undefined) return 0;
    return last.heapUsedBytes - first.heapUsedBytes;
  }

  clear(): void {
    this.snapshots.splice(0, this.snapshots.length);
  }
}
