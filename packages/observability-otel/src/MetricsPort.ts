/**
 * Metric label map — string key/value pairs attached to every data point.
 */
export type MetricLabels = Readonly<Record<string, string>>;

/**
 * Port for application metrics.
 *
 * Implementations wrap real metrics back-ends (OpenTelemetry, StatsD, etc.)
 * or provide a no-op suitable for tests.
 *
 * @example
 * ```typescript
 * metrics.incrementCounter('http.requests', 1, { method: 'GET', status: '200' });
 * metrics.recordHistogram('http.duration_ms', elapsed, { route: '/users' });
 * ```
 */
export interface MetricsPort {
  /**
   * Increment a monotonic counter by `value`.
   * Suitable for request counts, error totals, etc.
   */
  incrementCounter(name: string, value: number, labels?: MetricLabels): void;

  /**
   * Record an observed value in a histogram.
   * Suitable for latencies, payload sizes, queue depths, etc.
   */
  recordHistogram(name: string, value: number, labels?: MetricLabels): void;
}
