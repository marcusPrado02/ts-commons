/**
 * An event that can be projected into a read model.
 */
export interface ProjectedEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly occurredAt: Date;
  readonly payload?: unknown;
}

/**
 * Base read model shape. Every read model must have an id, version and updatedAt.
 */
export interface ReadModel {
  readonly id: string;
  version: number;
  updatedAt: Date;
}

/**
 * Generic read model store interface.
 */
export interface ReadModelStore<T extends ReadModel> {
  save(model: T): Promise<void>;
  findById(id: string): Promise<T | undefined>;
  findAll(): Promise<T[]>;
  delete(id: string): Promise<void>;
  size(): number;
}

/**
 * Aggregate snapshot used for event-sourcing optimization.
 */
export interface Snapshot<TState = unknown> {
  readonly aggregateId: string;
  readonly version: number;
  readonly state: TState;
  readonly takenAt: Date;
}

/**
 * Store for aggregate snapshots.
 */
export interface SnapshotStore<TState = unknown> {
  save(snapshot: Snapshot<TState>): Promise<void>;
  findLatest(aggregateId: string): Promise<Snapshot<TState> | undefined>;
  findByVersion(aggregateId: string, version: number): Promise<Snapshot<TState> | undefined>;
  delete(aggregateId: string): Promise<void>;
}

/**
 * Result of a projection rebuild operation.
 */
export interface RebuildResult {
  readonly projectionName: string;
  readonly eventsProcessed: number;
  readonly errors: number;
  readonly durationMs: number;
}

/**
 * Per-projection stats returned by ConsistencyMonitor.
 */
export interface ProjectionConsistencyStats {
  readonly averageLagMs: number;
  readonly maxLagMs: number;
  readonly sampleCount: number;
  readonly isHealthy: boolean;
}

/**
 * Overall consistency report across all registered projections.
 */
export interface ConsistencyReport {
  readonly projections: Record<string, ProjectionConsistencyStats>;
  readonly overallHealthy: boolean;
}
