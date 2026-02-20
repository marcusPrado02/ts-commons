/**
 * Arbitrary key/value string tags added to a metric to slice-and-dice data.
 *
 * @example { service: 'orders', region: 'us-east-1' }
 */
export type MetricDimensions = Readonly<Record<string, string>>;

/** Snapshot of a single counter (monotonically increasing value). */
export interface CounterSnapshot {
  readonly name: string;
  readonly value: number;
  readonly dimensions: MetricDimensions;
}

/** Snapshot of a single gauge (arbitrary numeric value). */
export interface GaugeSnapshot {
  readonly name: string;
  readonly value: number;
  readonly dimensions: MetricDimensions;
}

/** Aggregated snapshot of a histogram — pre-computed percentiles. */
export interface HistogramSnapshot {
  readonly name: string;
  readonly count: number;
  readonly sum: number;
  readonly min: number;
  readonly max: number;
  readonly avg: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly dimensions: MetricDimensions;
}

/** Complete point-in-time snapshot of every tracked metric. */
export interface MetricsSnapshot {
  readonly counters: readonly CounterSnapshot[];
  readonly gauges: readonly GaugeSnapshot[];
  readonly histograms: readonly HistogramSnapshot[];
  /** Unix epoch timestamp (ms) when the snapshot was captured. */
  readonly takenAtMs: number;
}
