import type { MetricsPort, MetricLabels } from './MetricsPort';
import type { OtelMeterClientLike } from './OtelMeterClientLike';

/**
 * OpenTelemetry-backed metrics adapter.
 *
 * Delegates to any object that structurally matches `OtelMeterClientLike` —
 * typically the meter obtained from `opentelemetry.metrics.getMeter(name)`.
 *
 * Counters and histograms are lazily created on first use and then cached so
 * that `createCounter` / `createHistogram` are called only once per name —
 * matching the expected usage of the OTel SDK.
 *
 * @example
 * ```typescript
 * import { metrics } from '@opentelemetry/api';
 * import { OtelMetrics } from '@acme/observability-otel';
 *
 * const m = new OtelMetrics(metrics.getMeter('my-service'));
 * m.incrementCounter('http.requests', 1, { method: 'GET', status: '200' });
 * m.recordHistogram('http.duration_ms', elapsed, { route: '/users' });
 * ```
 */
export class OtelMetrics implements MetricsPort {
  private readonly counters   = new Map<string, ReturnType<OtelMeterClientLike['createCounter']>>();
  private readonly histograms = new Map<string, ReturnType<OtelMeterClientLike['createHistogram']>>();

  constructor(private readonly meter: OtelMeterClientLike) {}

  incrementCounter(name: string, value: number, labels?: MetricLabels): void {
    let counter = this.counters.get(name);
    if (counter === undefined) {
      counter = this.meter.createCounter(name);
      this.counters.set(name, counter);
    }
    if (labels !== undefined) {
      counter.add(value, { ...labels });
    } else {
      counter.add(value);
    }
  }

  recordHistogram(name: string, value: number, labels?: MetricLabels): void {
    let histogram = this.histograms.get(name);
    if (histogram === undefined) {
      histogram = this.meter.createHistogram(name);
      this.histograms.set(name, histogram);
    }
    if (labels !== undefined) {
      histogram.record(value, { ...labels });
    } else {
      histogram.record(value);
    }
  }
}
