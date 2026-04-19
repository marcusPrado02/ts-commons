import type { DataPoint, DownsampleOptions } from './types.js';

/**
 * Reduces the density of a time series while preserving its visual shape.
 *
 * Two algorithms are provided:
 * - **mean** — each output bucket represents the arithmetic mean of its window
 * - **lttb** — Largest Triangle Three Buckets; preserves visual fidelity by
 *   picking the most significant real data point within each bucket
 */
export class Downsampler {
  /**
   * Reduce `points` to at most `options.targetPoints` entries using the
   * specified algorithm. If the source already has ≤ targetPoints entries the
   * original array is returned unchanged.
   */
  downsample(points: readonly DataPoint[], field: string, options: DownsampleOptions): DataPoint[] {
    if (points.length <= options.targetPoints) return [...points];
    return options.algorithm === 'mean'
      ? this.meanDownsample(points, field, options.targetPoints)
      : this.lttbDownsample(points, field, options.targetPoints);
  }

  // ── Mean downsampling ──────────────────────────────────────────────────────

  private meanDownsample(
    points: readonly DataPoint[],
    field: string,
    targetPoints: number,
  ): DataPoint[] {
    const result: DataPoint[] = [];
    const bucketSize = points.length / targetPoints;

    for (let i = 0; i < targetPoints; i++) {
      const start = Math.floor(i * bucketSize);
      const end = Math.min(Math.floor((i + 1) * bucketSize), points.length);
      const bucket = points.slice(start, end);
      if (bucket.length === 0) continue;
      result.push(this.buildMeanPoint(bucket, field));
    }
    return result;
  }

  private buildMeanPoint(bucket: readonly DataPoint[], field: string): DataPoint {
    const measurement = bucket[0]?.measurement ?? '';
    const timestamps = bucket.map((p) => p.timestamp);
    const values = bucket
      .map((p) => p.fields[field])
      .filter((v): v is number => typeof v === 'number');

    const avgTs = timestamps.reduce((a, b) => a + b, 0) / timestamps.length;
    const avgVal = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    return {
      timestamp: Math.round(avgTs),
      measurement,
      fields: { [field]: avgVal },
    };
  }

  // ── LTTB downsampling ──────────────────────────────────────────────────────

  private lttbDownsample(
    points: readonly DataPoint[],
    field: string,
    targetPoints: number,
  ): DataPoint[] {
    const first = points[0];
    const last = points[points.length - 1];
    if (first === undefined || last === undefined) return [];

    const result: DataPoint[] = [first];
    const bucketCount = targetPoints - 2;
    const bucketSize = (points.length - 2) / bucketCount;

    for (let i = 0; i < bucketCount; i++) {
      const { start, end } = this.bucketRange(i, bucketSize);
      const bucket = points.slice(start, end);
      const nextAvg = this.bucketAvg(points, i + 1, bucketCount, bucketSize, field);
      const prev = result[result.length - 1] ?? first;

      const best = this.maxAreaPoint(bucket, prev, nextAvg, field);
      if (best !== undefined) result.push(best);
    }

    result.push(last);
    return result;
  }

  private bucketRange(i: number, bucketSize: number): { start: number; end: number } {
    const start = Math.floor(i * bucketSize) + 1;
    const end = Math.floor((i + 1) * bucketSize) + 1;
    return { start, end };
  }

  private bucketAvg(
    points: readonly DataPoint[],
    i: number,
    bucketCount: number,
    bucketSize: number,
    field: string,
  ): { ts: number; val: number } {
    if (i >= bucketCount) {
      const last = points[points.length - 1];
      return { ts: last?.timestamp ?? 0, val: this.fieldValue(last, field) };
    }
    const { start, end } = this.bucketRange(i, bucketSize);
    const bucket = points.slice(start, end);
    const ts = bucket.reduce((a, p) => a + p.timestamp, 0) / (bucket.length || 1);
    const vals = bucket.map((p) => this.fieldValue(p, field));
    const val = vals.reduce((a, v) => a + v, 0) / (vals.length || 1);
    return { ts, val };
  }

  private maxAreaPoint(
    bucket: readonly DataPoint[],
    prev: DataPoint,
    nextAvg: { ts: number; val: number },
    field: string,
  ): DataPoint | undefined {
    let maxArea = -1;
    let best: DataPoint | undefined;

    for (const point of bucket) {
      const area = this.triangleArea(
        prev.timestamp,
        this.fieldValue(prev, field),
        point.timestamp,
        this.fieldValue(point, field),
        nextAvg.ts,
        nextAvg.val,
      );
      if (area > maxArea) {
        maxArea = area;
        best = point;
      }
    }
    return best;
  }

  private triangleArea(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
  ): number {
    return Math.abs((x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)) / 2);
  }

  private fieldValue(point: DataPoint | undefined, field: string): number {
    if (point === undefined) return 0;
    const v = point.fields[field];
    return typeof v === 'number' ? v : 0;
  }
}
