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
// Client interface  (mirrors Prometheus Pushgateway HTTP API)
// ---------------------------------------------------------------------------

/**
 * Minimal HTTP client for pushing Prometheus-format metrics.
 * Inject the real implementation via your HTTP library of choice.
 */
export interface PushGatewayClientLike {
  /** POST exposition-format text to `<baseUrl>/metrics/job/<jobName>`. */
  push(jobName: string, body: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Prometheus exposition-format helpers
// ---------------------------------------------------------------------------

function dimensionsToLabels(dimensions: MetricDimensions): string {
  const parts = Object.entries(dimensions).map(([k, v]) => `${k}="${v}"`);
  return parts.join(',');
}

function labelStr(dimensions: MetricDimensions): string {
  const inner = dimensionsToLabels(dimensions);
  return inner.length > 0 ? `{${inner}}` : '';
}

function buildCounterLines(c: CounterSnapshot): string {
  return `# TYPE ${c.name} counter\n${c.name}${labelStr(c.dimensions)} ${c.value}`;
}

function buildGaugeLines(g: GaugeSnapshot): string {
  return `# TYPE ${g.name} gauge\n${g.name}${labelStr(g.dimensions)} ${g.value}`;
}

function quantileLabelStr(dimensions: MetricDimensions, q: string): string {
  const inner = dimensionsToLabels(dimensions);
  return inner.length > 0 ? `{${inner},quantile="${q}"}` : `{quantile="${q}"}`;
}

function buildHistogramLines(h: HistogramSnapshot): string {
  const base = labelStr(h.dimensions);
  const lines = [
    `# TYPE ${h.name} summary`,
    `${h.name}_count${base} ${h.count}`,
    `${h.name}_sum${base} ${h.sum}`,
    `${h.name}${quantileLabelStr(h.dimensions, '0.5')} ${h.p50}`,
    `${h.name}${quantileLabelStr(h.dimensions, '0.95')} ${h.p95}`,
    `${h.name}${quantileLabelStr(h.dimensions, '0.99')} ${h.p99}`,
  ];
  return lines.join('\n');
}

function buildPrometheusBody(snapshot: MetricsSnapshot): string {
  const parts: string[] = [
    ...snapshot.counters.map(buildCounterLines),
    ...snapshot.gauges.map(buildGaugeLines),
    ...snapshot.histograms.map(buildHistogramLines),
  ];
  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Exporter
// ---------------------------------------------------------------------------

/**
 * Exports metrics to a **Grafana / Prometheus Pushgateway** in Prometheus
 * exposition text format.
 *
 * @example
 * ```ts
 * const exporter = new GrafanaMetricsExporter(pushClient, 'my-service', metrics);
 * await exporter.export(); // POST to <baseUrl>/metrics/job/my-service
 * ```
 */
export class GrafanaMetricsExporter {
  constructor(
    private readonly client: PushGatewayClientLike,
    private readonly jobName: string,
    private readonly metrics: MetricsPort,
  ) {}

  async export(): Promise<void> {
    const snapshot = this.metrics.getSnapshot();
    const body = buildPrometheusBody(snapshot);
    try {
      await this.client.push(this.jobName, body);
    } catch (cause) {
      throw new MetricsExportError(
        `Failed to push metrics to Grafana job "${this.jobName}"`,
        cause,
      );
    }
  }
}
