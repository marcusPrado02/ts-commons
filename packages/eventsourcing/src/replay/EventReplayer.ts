import type { EventStore } from '../EventStore.js';
import type { ReplayOptions, ReplayStats, ReplayHandler, ProgressCallback } from './types.js';

/**
 * Replays events from an {@link EventStore} with support for:
 * - Full replay of a stream
 * - Point-in-time replay (up to a given timestamp)
 * - Selective replay (specific event types only)
 * - Version range replay (fromVersion / toVersion)
 * - Progress monitoring via a {@link ProgressCallback}
 *
 * @example
 * ```ts
 * const replayer = new EventReplayer(store);
 * const stats = await replayer.replay('user-123', (event, version) => {
 *   aggregate.apply(event);
 * });
 * console.log(stats.eventsProcessed);
 * ```
 */
export class EventReplayer {
  private readonly store: EventStore;

  constructor(store: EventStore) {
    this.store = store;
  }

  /**
   * Replay events for `streamId`, applying `options` filters and invoking
   * `handler` for each event that passes.
   */
  async replay(
    streamId: string,
    handler: ReplayHandler,
    options: ReplayOptions = {},
    onProgress?: ProgressCallback,
  ): Promise<ReplayStats> {
    const startedAt = Date.now();
    const fromVersion = options.fromVersion ?? 0;
    const events = await this.store.getEvents(streamId, fromVersion);

    let processed = 0;
    let skipped = 0;

    for (let i = 0; i < events.length; i++) {
      const event = events[i]!;
      const version = fromVersion + i;

      if (options.toVersion !== undefined && version >= options.toVersion) break;

      if (!passesFilters(event, options)) {
        skipped++;
      } else {
        handler(event, version);
        processed++;
      }

      onProgress?.({
        streamId,
        eventsProcessed: processed,
        eventsSkipped: skipped,
        currentVersion: version,
      });
    }

    return {
      streamId,
      totalEvents: events.length,
      eventsProcessed: processed,
      eventsSkipped: skipped,
      durationMs: Date.now() - startedAt,
    };
  }

  /**
   * Replay all events that occurred at or before `timestamp`.
   */
  async replayPointInTime(
    streamId: string,
    timestamp: Date,
    handler: ReplayHandler,
    onProgress?: ProgressCallback,
  ): Promise<ReplayStats> {
    return this.replay(streamId, handler, { beforeTimestamp: timestamp }, onProgress);
  }

  /**
   * Replay only events whose `eventType` is in the `eventTypes` list.
   */
  async replaySelective(
    streamId: string,
    eventTypes: string[],
    handler: ReplayHandler,
    onProgress?: ProgressCallback,
  ): Promise<ReplayStats> {
    return this.replay(streamId, handler, { eventTypes }, onProgress);
  }

  /**
   * Fast-forward replay: loads events starting from `fromVersion` to
   * avoid reprocessing already-known history.
   */
  async fastForward(
    streamId: string,
    fromVersion: number,
    handler: ReplayHandler,
    onProgress?: ProgressCallback,
  ): Promise<ReplayStats> {
    return this.replay(streamId, handler, { fromVersion }, onProgress);
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function passesFilters(
  event: { occurredAt: Date; eventType: string },
  options: ReplayOptions,
): boolean {
  if (options.beforeTimestamp !== undefined && event.occurredAt > options.beforeTimestamp) {
    return false;
  }
  if (options.eventTypes !== undefined && !options.eventTypes.includes(event.eventType)) {
    return false;
  }
  return true;
}
