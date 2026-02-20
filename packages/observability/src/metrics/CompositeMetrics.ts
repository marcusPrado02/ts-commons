import type { MetricDimensions, MetricsSnapshot } from './MetricTypes';
import type { MetricsPort } from './MetricsPort';

/**
 * Fan-out decorator that forwards every metric call to multiple backends.
 *
 * `getSnapshot()` returns the snapshot from the **first** backend.
 *
 * @example
 * ```ts
 * const metrics = new CompositeMetrics([inMemory, grafanaExporter]);
 * metrics.incrementCounter('http.requests');
 * ```
 */
export class CompositeMetrics implements MetricsPort {
  constructor(private readonly backends: readonly MetricsPort[]) {}

  incrementCounter(name: string, value = 1, dimensions: MetricDimensions = {}): void {
    for (const b of this.backends) b.incrementCounter(name, value, dimensions);
  }

  decrementCounter(name: string, value = 1, dimensions: MetricDimensions = {}): void {
    for (const b of this.backends) b.decrementCounter(name, value, dimensions);
  }

  setGauge(name: string, value: number, dimensions: MetricDimensions = {}): void {
    for (const b of this.backends) b.setGauge(name, value, dimensions);
  }

  recordHistogram(name: string, value: number, dimensions: MetricDimensions = {}): void {
    for (const b of this.backends) b.recordHistogram(name, value, dimensions);
  }

  getSnapshot(): MetricsSnapshot {
    const first = this.backends[0];
    if (first === undefined) {
      return { counters: [], gauges: [], histograms: [], takenAtMs: Date.now() };
    }
    return first.getSnapshot();
  }

  reset(): void {
    for (const b of this.backends) b.reset();
  }
}
