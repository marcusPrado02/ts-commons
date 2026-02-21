import type { GcEvent, GcStats } from './MemoryTypes';

/**
 * Records GC events and computes aggregated statistics.
 *
 * @example
 * ```typescript
 * const gc = new GcMetricsCollector();
 * gc.record({ occurredAt: new Date(), durationMs: 5, type: 'minor', reclaimedBytes: 1024 });
 * const stats = gc.stats();
 * ```
 */
export class GcMetricsCollector {
  private readonly events: GcEvent[] = [];

  /** Register a new GC event. */
  record(event: GcEvent): void {
    this.events.push({ ...event });
  }

  /** All recorded events in insertion order. */
  getAll(): GcEvent[] {
    return this.events.map((e) => ({ ...e }));
  }

  /** Events filtered by GC type. */
  getByType(type: GcEvent['type']): GcEvent[] {
    return this.events.filter((e) => e.type === type).map((e) => ({ ...e }));
  }

  eventCount(): number {
    return this.events.length;
  }

  /** Aggregated statistics over all recorded events. */
  stats(): GcStats {
    const total = this.events.length;
    if (total === 0) {
      return {
        totalEvents: 0,
        totalDurationMs: 0,
        totalReclaimedBytes: 0,
        avgDurationMs: 0,
        majorCount: 0,
        minorCount: 0,
        incrementalCount: 0,
      };
    }
    let durationMs = 0;
    let reclaimedBytes = 0;
    let major = 0;
    let minor = 0;
    let incremental = 0;
    for (const e of this.events) {
      durationMs += e.durationMs;
      reclaimedBytes += e.reclaimedBytes;
      if (e.type === 'major') major++;
      else if (e.type === 'minor') minor++;
      else incremental++;
    }
    return {
      totalEvents: total,
      totalDurationMs: durationMs,
      totalReclaimedBytes: reclaimedBytes,
      avgDurationMs: durationMs / total,
      majorCount: major,
      minorCount: minor,
      incrementalCount: incremental,
    };
  }

  /** Total GC time as a fraction of elapsed wall time between first and last event. */
  gcPressureRatio(): number {
    if (this.events.length < 2) return 0;
    const first = this.events[0];
    const last = this.events.at(-1);
    if (first === undefined || last === undefined) return 0;
    const elapsed = last.occurredAt.getTime() - first.occurredAt.getTime();
    if (elapsed <= 0) return 0;
    const totalGc = this.events.reduce((sum, e) => sum + e.durationMs, 0);
    return totalGc / elapsed;
  }

  /** The single longest GC event, or `undefined` when empty. */
  longestEvent(): GcEvent | undefined {
    if (this.events.length === 0) return undefined;
    return this.events.reduce((max, e) => (e.durationMs > max.durationMs ? e : max));
  }

  clear(): void {
    this.events.splice(0, this.events.length);
  }
}
