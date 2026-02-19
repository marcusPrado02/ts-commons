import type { MetricsPort, MetricLabels } from './MetricsPort';

/**
 * No-op metrics — silently discards all measurements.
 *
 * Use in tests or when metrics are intentionally disabled so that code wired
 * to `MetricsPort` keeps working without configuration.
 *
 * @example
 * ```typescript
 * const metrics: MetricsPort = isMetricsEnabled
 *   ? new OtelMetrics(otelMeter)
 *   : new NoopMetrics();
 * ```
 */
export class NoopMetrics implements MetricsPort {
  incrementCounter(_name: string, _value: number, _labels?: MetricLabels): void { /* noop */ }
  recordHistogram(_name: string, _value: number, _labels?: MetricLabels): void { /* noop */ }
}
