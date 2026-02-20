import type { MetricsPort } from './MetricsPort';
import type {
  CounterSnapshot,
  GaugeSnapshot,
  HistogramSnapshot,
  MetricDimensions,
  MetricsSnapshot,
} from './MetricTypes';

// ---------------------------------------------------------------------------
// Internal entry types (mutable `value` intentional)
// ---------------------------------------------------------------------------

interface CounterEntry {
  readonly name: string;
  value: number;
  readonly dimensions: MetricDimensions;
}

interface GaugeEntry {
  readonly name: string;
  value: number;
  readonly dimensions: MetricDimensions;
}

interface HistogramEntry {
  readonly name: string;
  readonly values: number[];
  readonly dimensions: MetricDimensions;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dimKey(dimensions: MetricDimensions): string {
  const entries = Object.entries(dimensions).sort((a, b) => a[0].localeCompare(b[0]));
  return JSON.stringify(entries);
}

function metricKey(name: string, dimensions: MetricDimensions): string {
  return `${name}::${dimKey(dimensions)}`;
}

function computePercentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.ceil(sorted.length * p) - 1);
  return sorted[idx] ?? 0;
}

function toCounterSnapshot(entry: CounterEntry): CounterSnapshot {
  return { name: entry.name, value: entry.value, dimensions: entry.dimensions };
}

function toGaugeSnapshot(entry: GaugeEntry): GaugeSnapshot {
  return { name: entry.name, value: entry.value, dimensions: entry.dimensions };
}

function toHistogramSnapshot(entry: HistogramEntry): HistogramSnapshot {
  const sorted = [...entry.values].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const avg = count > 0 ? sum / count : 0;
  return {
    name: entry.name,
    count,
    sum,
    min: sorted[0] ?? 0,
    max: sorted[count - 1] ?? 0,
    avg,
    p50: computePercentile(sorted, 0.5),
    p95: computePercentile(sorted, 0.95),
    p99: computePercentile(sorted, 0.99),
    dimensions: entry.dimensions,
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Pure in-memory metrics store with aggregation and percentile computation.
 *
 * Tracks counters, gauges, and histograms keyed by name + dimensions.
 * Percentiles are computed lazily when {@link getSnapshot} is called.
 *
 * @example
 * ```ts
 * const metrics = new InMemoryMetrics();
 * metrics.incrementCounter('orders.placed', 1, { region: 'us-east-1' });
 * metrics.recordHistogram('db.query.ms', 42);
 * const snap = metrics.getSnapshot();
 * ```
 */
export class InMemoryMetrics implements MetricsPort {
  private readonly counters = new Map<string, CounterEntry>();
  private readonly gauges = new Map<string, GaugeEntry>();
  private readonly histograms = new Map<string, HistogramEntry>();

  incrementCounter(name: string, value = 1, dimensions: MetricDimensions = {}): void {
    const key = metricKey(name, dimensions);
    const existing = this.counters.get(key);
    if (existing === undefined) {
      this.counters.set(key, { name, value, dimensions });
    } else {
      existing.value += value;
    }
  }

  decrementCounter(name: string, value = 1, dimensions: MetricDimensions = {}): void {
    this.incrementCounter(name, -value, dimensions);
  }

  setGauge(name: string, value: number, dimensions: MetricDimensions = {}): void {
    const key = metricKey(name, dimensions);
    const existing = this.gauges.get(key);
    if (existing === undefined) {
      this.gauges.set(key, { name, value, dimensions });
    } else {
      existing.value = value;
    }
  }

  recordHistogram(name: string, value: number, dimensions: MetricDimensions = {}): void {
    const key = metricKey(name, dimensions);
    const existing = this.histograms.get(key);
    if (existing === undefined) {
      this.histograms.set(key, { name, values: [value], dimensions });
    } else {
      existing.values.push(value);
    }
  }

  getSnapshot(): MetricsSnapshot {
    return {
      counters: [...this.counters.values()].map(toCounterSnapshot),
      gauges: [...this.gauges.values()].map(toGaugeSnapshot),
      histograms: [...this.histograms.values()].map(toHistogramSnapshot),
      takenAtMs: Date.now(),
    };
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}
