import type {
  CounterSnapshot,
  GaugeSnapshot,
  HistogramSnapshot,
  MetricDimensions,
  MetricsSnapshot,
} from './MetricTypes';
import type { MetricsPort } from './MetricsPort';
import { MetricsExportError } from './MetricsErrors';

// ---------------------------------------------------------------------------
// Client interface  (mirrors DataDog Metrics API v1)
// ---------------------------------------------------------------------------

/** Points format: [unix_timestamp_seconds, value] */
export type DataDogPoint = readonly [number, number];

export interface DataDogMetricSeries {
  readonly metric: string;
  /** 1 = count, 3 = gauge */
  readonly type: 1 | 3;
  readonly points: readonly DataDogPoint[];
  readonly tags: readonly string[];
}

/**
 * Minimal HTTP client for the DataDog Metrics API.
 * Inject via your HTTP library.
 */
export interface DataDogHttpClientLike {
  postSeries(series: readonly DataDogMetricSeries[]): Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dimsToDogTags(dimensions: MetricDimensions): readonly string[] {
  return Object.entries(dimensions).map(([k, v]) => `${k}:${v}`);
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function countersToSeries(
  counters: readonly CounterSnapshot[],
  ts: number,
): readonly DataDogMetricSeries[] {
  return counters.map((c) => ({
    metric: c.name,
    type: 1 as const,
    points: [[ts, c.value]] as readonly DataDogPoint[],
    tags: dimsToDogTags(c.dimensions),
  }));
}

function gaugesToSeries(
  gauges: readonly GaugeSnapshot[],
  ts: number,
): readonly DataDogMetricSeries[] {
  return gauges.map((g) => ({
    metric: g.name,
    type: 3 as const,
    points: [[ts, g.value]] as readonly DataDogPoint[],
    tags: dimsToDogTags(g.dimensions),
  }));
}

function histogramsToSeries(
  histograms: readonly HistogramSnapshot[],
  ts: number,
): readonly DataDogMetricSeries[] {
  return histograms.flatMap((h) => [
    {
      metric: `${h.name}.count`,
      type: 1 as const,
      points: [[ts, h.count]] as readonly DataDogPoint[],
      tags: dimsToDogTags(h.dimensions),
    },
    {
      metric: `${h.name}.avg`,
      type: 3 as const,
      points: [[ts, h.avg]] as readonly DataDogPoint[],
      tags: dimsToDogTags(h.dimensions),
    },
    {
      metric: `${h.name}.p95`,
      type: 3 as const,
      points: [[ts, h.p95]] as readonly DataDogPoint[],
      tags: dimsToDogTags(h.dimensions),
    },
    {
      metric: `${h.name}.p99`,
      type: 3 as const,
      points: [[ts, h.p99]] as readonly DataDogPoint[],
      tags: dimsToDogTags(h.dimensions),
    },
  ]);
}

function buildDataDogSeries(snapshot: MetricsSnapshot): readonly DataDogMetricSeries[] {
  const ts = nowSeconds();
  return [
    ...countersToSeries(snapshot.counters, ts),
    ...gaugesToSeries(snapshot.gauges, ts),
    ...histogramsToSeries(snapshot.histograms, ts),
  ];
}

// ---------------------------------------------------------------------------
// Exporter
// ---------------------------------------------------------------------------

/**
 * Exports metrics to **DataDog** via the v1 Metrics series API.
 *
 * Each counter → `count` type; each gauge → `gauge` type;
 * each histogram explodes into `.count`, `.avg`, `.p95`, `.p99` gauges.
 *
 * @example
 * ```ts
 * const exporter = new DataDogMetricsExporter(ddClient, metrics);
 * await exporter.export();
 * ```
 */
export class DataDogMetricsExporter {
  constructor(
    private readonly client: DataDogHttpClientLike,
    private readonly metrics: MetricsPort,
  ) {}

  async export(): Promise<void> {
    const snapshot = this.metrics.getSnapshot();
    const series = buildDataDogSeries(snapshot);
    try {
      await this.client.postSeries(series);
    } catch (cause) {
      throw new MetricsExportError('Failed to export metrics to DataDog', cause);
    }
  }
}
