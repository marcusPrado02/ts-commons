/**
 * Shared types for the memory profiling module (Item 52).
 */

/** A point-in-time capture of V8 heap usage. */
export interface HeapSnapshot {
  readonly capturedAt: Date;
  readonly heapUsedBytes: number;
  readonly heapTotalBytes: number;
  readonly externalBytes: number;
  readonly arrayBuffersBytes: number;
  readonly label?: string;
}

/** Result of comparing two heap snapshots. */
export interface HeapDiff {
  readonly from: Date;
  readonly to: Date;
  readonly heapDeltaBytes: number;
  readonly externalDeltaBytes: number;
}

/** A record of a suspected memory leak. */
export interface LeakRecord {
  readonly detectedAt: Date;
  readonly growthBytes: number;
  readonly snapshotCount: number;
  readonly message: string;
}

/** A single GC run observation. */
export interface GcEvent {
  readonly occurredAt: Date;
  readonly durationMs: number;
  readonly type: 'minor' | 'major' | 'incremental';
  readonly reclaimedBytes: number;
}

/** Aggregated GC statistics over a time window. */
export interface GcStats {
  readonly totalEvents: number;
  readonly totalDurationMs: number;
  readonly totalReclaimedBytes: number;
  readonly avgDurationMs: number;
  readonly majorCount: number;
  readonly minorCount: number;
  readonly incrementalCount: number;
}

/** Rule that triggers a memory alert. */
export interface MemoryAlertRule {
  readonly name: string;
  readonly thresholdBytes: number;
  readonly metric: 'heapUsed' | 'heapTotal' | 'external' | 'rss';
}

/** A fired memory alert. */
export interface MemoryAlert {
  readonly rule: string;
  readonly firedAt: Date;
  readonly thresholdBytes: number;
  readonly actualBytes: number;
  readonly overageBytes: number;
}
