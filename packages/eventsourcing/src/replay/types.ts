import type { DomainEvent } from '@acme/kernel';

/**
 * Options that control how events are replayed from the store.
 */
export interface ReplayOptions {
  /** Skip events before this version index (0-based). Defaults to 0. */
  readonly fromVersion?: number;
  /** Stop replaying at this version index (exclusive). Undefined = replay all. */
  readonly toVersion?: number;
  /** Only replay events whose `occurredAt` is on or before this timestamp. */
  readonly beforeTimestamp?: Date;
  /** Only replay events whose `eventType` is in this list. */
  readonly eventTypes?: string[];
}

/**
 * Snapshot of the current replay progress.
 */
export interface ReplayProgress {
  readonly streamId: string;
  readonly eventsProcessed: number;
  readonly eventsSkipped: number;
  readonly currentVersion: number;
}

/**
 * Final statistics from a completed replay operation.
 */
export interface ReplayStats {
  readonly streamId: string;
  readonly totalEvents: number;
  readonly eventsProcessed: number;
  readonly eventsSkipped: number;
  readonly durationMs: number;
}

/**
 * Handler invoked for each event that passes replay filters.
 */
export type ReplayHandler = (event: DomainEvent, version: number) => void;

/**
 * Progress callback invoked after each event is considered during replay.
 */
export type ProgressCallback = (progress: ReplayProgress) => void;
