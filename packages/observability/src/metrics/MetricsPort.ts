import type { MetricDimensions, MetricsSnapshot } from './MetricTypes';

/**
 * Port for business metrics tracking — counters, gauges, and histograms
 * with support for custom dimensions (tags).
 *
 * Implementations: {@link InMemoryMetrics}, or any adapter exporting to an
 * external system ({@link GrafanaMetricsExporter}, {@link DataDogMetricsExporter}).
 */
export interface MetricsPort {
  /**
   * Increment a named counter by `value` (default 1).
   * Creates the counter if it does not already exist.
   */
  incrementCounter(name: string, value?: number, dimensions?: MetricDimensions): void;

  /**
   * Decrement a named counter by `value` (default 1).
   * Delegates to {@link incrementCounter} with a negated value.
   */
  decrementCounter(name: string, value?: number, dimensions?: MetricDimensions): void;

  /**
   * Set a gauge to an absolute numeric value.
   * Overwrites the previous value entirely.
   */
  setGauge(name: string, value: number, dimensions?: MetricDimensions): void;

  /**
   * Record a single observation into a histogram bucket.
   * Multiple calls accumulate; percentiles are computed on {@link getSnapshot}.
   */
  recordHistogram(name: string, value: number, dimensions?: MetricDimensions): void;

  /** Return a consistent snapshot of all current metric values. */
  getSnapshot(): MetricsSnapshot;

  /** Clear all counters, gauges, and histogram samples. */
  reset(): void;
}
