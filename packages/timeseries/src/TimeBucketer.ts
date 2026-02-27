import type { BucketInterval, DataPoint, TimeBucket, Timestamp } from './types.js';

const INTERVAL_MS: Record<BucketInterval, number | null> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 7 * 86_400_000,
  month: null, // computed via Date arithmetic
};

/**
 * Groups time series data points into fixed-size time buckets.
 *
 * Each bucket's `timestamp` is aligned to the *start* of that interval,
 * making the buckets sortable and directly comparable.
 *
 * @example
 * ```ts
 * const bucketer = new TimeBucketer();
 * const buckets = bucketer.bucket(points, 'hour');
 * ```
 */
export class TimeBucketer {
  /**
   * Partition `points` into {@link TimeBucket}s of the given `interval`.
   * Buckets are returned in ascending chronological order.
   */
  bucket(points: readonly DataPoint[], interval: BucketInterval): TimeBucket[] {
    const map = new Map<Timestamp, DataPoint[]>();

    for (const point of points) {
      const start = this.getBucketStart(point.timestamp, interval);
      const existing = map.get(start);
      if (existing !== undefined) {
        existing.push(point);
      } else {
        map.set(start, [point]);
      }
    }

    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([ts, pts]) => ({ timestamp: ts, interval, points: pts }));
  }

  /**
   * Returns the start timestamp (epoch ms) of the bucket that contains `ts`
   * for the given `interval`.
   */
  getBucketStart(ts: Timestamp, interval: BucketInterval): Timestamp {
    const ms = INTERVAL_MS[interval];
    if (ms !== null) {
      return Math.floor(ts / ms) * ms;
    }
    return this.getMonthStart(ts);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private getMonthStart(ts: Timestamp): Timestamp {
    const d = new Date(ts);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  }
}
