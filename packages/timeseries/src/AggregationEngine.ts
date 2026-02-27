import type { AggregateFunction, AggregateResult, DataPoint, TimeRange } from './types.js';

/**
 * Computes statistical aggregates over a set of {@link DataPoint} field values.
 *
 * Supported functions: `sum`, `avg`, `min`, `max`, `count`, `stddev`.
 *
 * @example
 * ```ts
 * const engine = new AggregationEngine();
 * const result = engine.aggregate(points, 'temperature', 'avg');
 * ```
 */
export class AggregationEngine {
  /**
   * Aggregate all values of `field` across `points` using function `fn`.
   *
   * @param range - Time range context attached to the result (not used for filtering).
   *   To pre-filter by time range, slice the points array before calling.
   */
  aggregate(
    points: readonly DataPoint[],
    field: string,
    fn: AggregateFunction,
    range: TimeRange = { start: 0, end: Date.now() },
  ): AggregateResult {
    const measurement = points[0]?.measurement ?? '';
    const values = this.extractValues(points, field);
    const value = this.compute(values, fn);
    return { measurement, field, fn, value, range };
  }

  // ── Private dispatch ───────────────────────────────────────────────────────

  private compute(values: readonly number[], fn: AggregateFunction): number {
    if (fn === 'sum') return this.sum(values);
    if (fn === 'avg') return this.avg(values);
    if (fn === 'min') return this.min(values);
    if (fn === 'max') return this.max(values);
    if (fn === 'count') return values.length;
    return this.stddev(values);
  }

  private extractValues(points: readonly DataPoint[], field: string): number[] {
    return points.map((p) => p.fields[field]).filter((v): v is number => typeof v === 'number');
  }

  // ── Statistical helpers ────────────────────────────────────────────────────

  private sum(values: readonly number[]): number {
    return values.reduce((acc, v) => acc + v, 0);
  }

  private avg(values: readonly number[]): number {
    if (values.length === 0) return 0;
    return this.sum(values) / values.length;
  }

  private min(values: readonly number[]): number {
    if (values.length === 0) return 0;
    return Math.min(...values);
  }

  private max(values: readonly number[]): number {
    if (values.length === 0) return 0;
    return Math.max(...values);
  }

  private stddev(values: readonly number[]): number {
    if (values.length < 2) return 0;
    const mean = this.avg(values);
    const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }
}
