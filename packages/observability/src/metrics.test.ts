/**
 * Tests for @acme/observability — Analytics & Metrics (Item 41)
 *
 * InMemoryMetrics · CompositeMetrics · GrafanaMetricsExporter · DataDogMetricsExporter
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { CompositeMetrics } from './metrics/CompositeMetrics';
import type { DataDogHttpClientLike, DataDogMetricSeries } from './metrics/DataDogMetricsExporter';
import { DataDogMetricsExporter } from './metrics/DataDogMetricsExporter';
import { MetricsExportError, MetricsUnavailableError } from './metrics/MetricsErrors';
import type { PushGatewayClientLike } from './metrics/GrafanaMetricsExporter';
import { GrafanaMetricsExporter } from './metrics/GrafanaMetricsExporter';
import { InMemoryMetrics } from './metrics/InMemoryMetrics';
import type { MetricsPort } from './metrics/MetricsPort';

// ---------------------------------------------------------------------------
// MetricsErrors
// ---------------------------------------------------------------------------

describe('MetricsErrors', () => {
  it('MetricsExportError has correct name and message', () => {
    const err = new MetricsExportError('push failed');
    expect(err.name).toBe('MetricsExportError');
    expect(err.message).toBe('push failed');
    expect(err).toBeInstanceOf(Error);
  });

  it('MetricsExportError captures cause', () => {
    const cause = new Error('timeout');
    const err = new MetricsExportError('push failed', cause);
    expect(err.cause).toBe(cause);
  });

  it('MetricsUnavailableError has correct name and cause', () => {
    const cause = new Error('refused');
    const err = new MetricsUnavailableError(cause);
    expect(err.name).toBe('MetricsUnavailableError');
    expect(err.cause).toBe(cause);
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// InMemoryMetrics
// ---------------------------------------------------------------------------

describe('InMemoryMetrics', () => {
  let metrics: InMemoryMetrics;

  beforeEach(() => {
    metrics = new InMemoryMetrics();
  });

  it('incrementCounter creates a counter with initial value', () => {
    metrics.incrementCounter('requests');
    const snap = metrics.getSnapshot();
    expect(snap.counters[0]?.value).toBe(1);
    expect(snap.counters[0]?.name).toBe('requests');
  });

  it('incrementCounter accumulates multiple calls', () => {
    metrics.incrementCounter('requests');
    metrics.incrementCounter('requests');
    metrics.incrementCounter('requests', 3);
    expect(metrics.getSnapshot().counters[0]?.value).toBe(5);
  });

  it('decrementCounter subtracts from the counter', () => {
    metrics.incrementCounter('errors', 10);
    metrics.decrementCounter('errors', 3);
    expect(metrics.getSnapshot().counters[0]?.value).toBe(7);
  });

  it('different dimensions are tracked separately', () => {
    metrics.incrementCounter('requests', 1, { region: 'us' });
    metrics.incrementCounter('requests', 2, { region: 'eu' });
    const snap = metrics.getSnapshot();
    expect(snap.counters).toHaveLength(2);
    const total = snap.counters.reduce((acc, c) => acc + c.value, 0);
    expect(total).toBe(3);
  });

  it('dimensions are stored in counter snapshot', () => {
    metrics.incrementCounter('hits', 1, { env: 'prod' });
    const snap = metrics.getSnapshot();
    expect(snap.counters[0]?.dimensions['env']).toBe('prod');
  });

  it('setGauge stores the value', () => {
    metrics.setGauge('cpu.usage', 0.72);
    const snap = metrics.getSnapshot();
    expect(snap.gauges[0]?.value).toBe(0.72);
    expect(snap.gauges[0]?.name).toBe('cpu.usage');
  });

  it('setGauge overwrites the previous value', () => {
    metrics.setGauge('cpu.usage', 0.5);
    metrics.setGauge('cpu.usage', 0.9);
    const snap = metrics.getSnapshot();
    expect(snap.gauges).toHaveLength(1);
    expect(snap.gauges[0]?.value).toBe(0.9);
  });

  it('setGauge with different dimensions creates separate entries', () => {
    metrics.setGauge('mem', 80, { host: 'a' });
    metrics.setGauge('mem', 60, { host: 'b' });
    expect(metrics.getSnapshot().gauges).toHaveLength(2);
  });

  it('recordHistogram stores count and sum', () => {
    metrics.recordHistogram('latency', 10);
    metrics.recordHistogram('latency', 20);
    metrics.recordHistogram('latency', 30);
    const snap = metrics.getSnapshot();
    const h = snap.histograms[0];
    expect(h?.count).toBe(3);
    expect(h?.sum).toBe(60);
  });

  it('recordHistogram computes min and max', () => {
    metrics.recordHistogram('latency', 5);
    metrics.recordHistogram('latency', 100);
    metrics.recordHistogram('latency', 42);
    const h = metrics.getSnapshot().histograms[0];
    expect(h?.min).toBe(5);
    expect(h?.max).toBe(100);
  });

  it('recordHistogram computes avg', () => {
    metrics.recordHistogram('latency', 10);
    metrics.recordHistogram('latency', 20);
    const h = metrics.getSnapshot().histograms[0];
    expect(h?.avg).toBe(15);
  });

  it('recordHistogram computes p50 / p95 / p99', () => {
    for (let i = 1; i <= 10; i++) metrics.recordHistogram('latency', i);
    const h = metrics.getSnapshot().histograms[0];
    // sorted: [1,2,3,4,5,6,7,8,9,10]
    // p50: ceil(10*0.5)-1 = 4 → value 5
    // p95: ceil(10*0.95)-1 = 9 → value 10
    // p99: ceil(10*0.99)-1 = 9 → value 10
    expect(h?.p50).toBe(5);
    expect(h?.p95).toBe(10);
    expect(h?.p99).toBe(10);
  });

  it('getSnapshot includes takenAtMs timestamp', () => {
    const before = Date.now();
    const snap = metrics.getSnapshot();
    const after = Date.now();
    expect(snap.takenAtMs).toBeGreaterThanOrEqual(before);
    expect(snap.takenAtMs).toBeLessThanOrEqual(after);
  });

  it('reset clears all counters gauges and histograms', () => {
    metrics.incrementCounter('c');
    metrics.setGauge('g', 1);
    metrics.recordHistogram('h', 1);
    metrics.reset();
    const snap = metrics.getSnapshot();
    expect(snap.counters).toHaveLength(0);
    expect(snap.gauges).toHaveLength(0);
    expect(snap.histograms).toHaveLength(0);
  });

  it('empty histogram snapshot returns zeros', () => {
    metrics.recordHistogram('noop', 0);
    metrics.reset();
    // After reset no histograms, no crash
    expect(metrics.getSnapshot().histograms).toHaveLength(0);
  });

  it('histogram with single value has equal min max avg', () => {
    metrics.recordHistogram('single', 42);
    const h = metrics.getSnapshot().histograms[0];
    expect(h?.min).toBe(42);
    expect(h?.max).toBe(42);
    expect(h?.avg).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// CompositeMetrics
// ---------------------------------------------------------------------------

describe('CompositeMetrics', () => {
  it('forwards incrementCounter to all backends', () => {
    const a = new InMemoryMetrics();
    const b = new InMemoryMetrics();
    const composite = new CompositeMetrics([a, b]);
    composite.incrementCounter('requests', 5);
    expect(a.getSnapshot().counters[0]?.value).toBe(5);
    expect(b.getSnapshot().counters[0]?.value).toBe(5);
  });

  it('forwards decrementCounter to all backends', () => {
    const a = new InMemoryMetrics();
    const b = new InMemoryMetrics();
    const composite = new CompositeMetrics([a, b]);
    composite.incrementCounter('c', 10);
    composite.decrementCounter('c', 3);
    expect(a.getSnapshot().counters[0]?.value).toBe(7);
    expect(b.getSnapshot().counters[0]?.value).toBe(7);
  });

  it('forwards setGauge to all backends', () => {
    const a = new InMemoryMetrics();
    const b = new InMemoryMetrics();
    const composite = new CompositeMetrics([a, b]);
    composite.setGauge('cpu', 0.9);
    expect(a.getSnapshot().gauges[0]?.value).toBe(0.9);
    expect(b.getSnapshot().gauges[0]?.value).toBe(0.9);
  });

  it('forwards recordHistogram to all backends', () => {
    const a = new InMemoryMetrics();
    const b = new InMemoryMetrics();
    const composite = new CompositeMetrics([a, b]);
    composite.recordHistogram('latency', 55);
    expect(a.getSnapshot().histograms[0]?.sum).toBe(55);
    expect(b.getSnapshot().histograms[0]?.sum).toBe(55);
  });

  it('getSnapshot returns snapshot from first backend', () => {
    const a = new InMemoryMetrics();
    const b = new InMemoryMetrics();
    a.incrementCounter('a_only', 99);
    const composite = new CompositeMetrics([a, b]);
    const snap = composite.getSnapshot();
    expect(snap.counters[0]?.name).toBe('a_only');
  });

  it('getSnapshot on empty composite returns empty snapshot', () => {
    const composite = new CompositeMetrics([]);
    const snap = composite.getSnapshot();
    expect(snap.counters).toHaveLength(0);
    expect(snap.gauges).toHaveLength(0);
    expect(snap.histograms).toHaveLength(0);
  });

  it('reset forwards to all backends', () => {
    const a = new InMemoryMetrics();
    const b = new InMemoryMetrics();
    a.incrementCounter('c');
    b.incrementCounter('c');
    const composite = new CompositeMetrics([a, b]);
    composite.reset();
    expect(a.getSnapshot().counters).toHaveLength(0);
    expect(b.getSnapshot().counters).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// GrafanaMetricsExporter
// ---------------------------------------------------------------------------

function buildPushClient(capturedArgs?: { jobName: string; body: string }): PushGatewayClientLike {
  return {
    push: (jobName, body) => {
      if (capturedArgs !== undefined) {
        capturedArgs.jobName = jobName;
        capturedArgs.body = body;
      }
      return Promise.resolve();
    },
  };
}

function buildFailingPushClient(): PushGatewayClientLike {
  return { push: () => Promise.reject(new Error('network error')) };
}

describe('GrafanaMetricsExporter', () => {
  let inner: InMemoryMetrics;

  beforeEach(() => {
    inner = new InMemoryMetrics();
  });

  it('calls push with the configured job name', async () => {
    const captured = { jobName: '', body: '' };
    const exporter = new GrafanaMetricsExporter(buildPushClient(captured), 'my-service', inner);
    await exporter.export();
    expect(captured.jobName).toBe('my-service');
  });

  it('body includes counter metric line', async () => {
    inner.incrementCounter('http_requests', 42);
    const captured = { jobName: '', body: '' };
    await new GrafanaMetricsExporter(buildPushClient(captured), 'svc', inner).export();
    expect(captured.body).toContain('http_requests');
    expect(captured.body).toContain('42');
  });

  it('body includes gauge metric line', async () => {
    inner.setGauge('cpu_usage', 0.8);
    const captured = { jobName: '', body: '' };
    await new GrafanaMetricsExporter(buildPushClient(captured), 'svc', inner).export();
    expect(captured.body).toContain('cpu_usage');
    expect(captured.body).toContain('0.8');
  });

  it('body includes histogram summary lines', async () => {
    inner.recordHistogram('db_query_ms', 25);
    inner.recordHistogram('db_query_ms', 75);
    const captured = { jobName: '', body: '' };
    await new GrafanaMetricsExporter(buildPushClient(captured), 'svc', inner).export();
    expect(captured.body).toContain('db_query_ms_count');
    expect(captured.body).toContain('db_query_ms_sum');
  });

  it('body includes dimension labels for counters', async () => {
    inner.incrementCounter('req', 1, { env: 'prod' });
    const captured = { jobName: '', body: '' };
    await new GrafanaMetricsExporter(buildPushClient(captured), 'svc', inner).export();
    expect(captured.body).toContain('env="prod"');
  });

  it('wraps push errors in MetricsExportError', async () => {
    const exporter = new GrafanaMetricsExporter(buildFailingPushClient(), 'svc', inner);
    await expect(exporter.export()).rejects.toBeInstanceOf(MetricsExportError);
  });
});

// ---------------------------------------------------------------------------
// DataDogMetricsExporter
// ---------------------------------------------------------------------------

function buildDdClient(capturedSeries?: {
  series: readonly DataDogMetricSeries[];
}): DataDogHttpClientLike {
  return {
    postSeries: (series) => {
      if (capturedSeries !== undefined) capturedSeries.series = series;
      return Promise.resolve();
    },
  };
}

function buildFailingDdClient(): DataDogHttpClientLike {
  return { postSeries: () => Promise.reject(new Error('forbidden')) };
}

describe('DataDogMetricsExporter', () => {
  let inner: InMemoryMetrics;

  beforeEach(() => {
    inner = new InMemoryMetrics();
  });

  it('calls postSeries on export', async () => {
    let called = false;
    const client: DataDogHttpClientLike = {
      postSeries: () => {
        called = true;
        return Promise.resolve();
      },
    };
    await new DataDogMetricsExporter(client, inner).export();
    expect(called).toBe(true);
  });

  it('counters are mapped to type 1 (count)', async () => {
    inner.incrementCounter('orders', 7);
    const captured: { series: readonly DataDogMetricSeries[] } = { series: [] };
    await new DataDogMetricsExporter(buildDdClient(captured), inner).export();
    const s = captured.series.find((s) => s.metric === 'orders');
    expect(s?.type).toBe(1);
    expect(s?.points[0]?.[1]).toBe(7);
  });

  it('gauges are mapped to type 3 (gauge)', async () => {
    inner.setGauge('memory.used', 512);
    const captured: { series: readonly DataDogMetricSeries[] } = { series: [] };
    await new DataDogMetricsExporter(buildDdClient(captured), inner).export();
    const s = captured.series.find((s) => s.metric === 'memory.used');
    expect(s?.type).toBe(3);
    expect(s?.points[0]?.[1]).toBe(512);
  });

  it('histograms produce .count and .avg series', async () => {
    inner.recordHistogram('latency', 10);
    inner.recordHistogram('latency', 20);
    const captured: { series: readonly DataDogMetricSeries[] } = { series: [] };
    await new DataDogMetricsExporter(buildDdClient(captured), inner).export();
    const names = captured.series.map((s) => s.metric);
    expect(names).toContain('latency.count');
    expect(names).toContain('latency.avg');
    expect(names).toContain('latency.p95');
    expect(names).toContain('latency.p99');
  });

  it('dimensions are converted to DataDog tags', async () => {
    inner.incrementCounter('req', 1, { service: 'api', env: 'prod' });
    const captured: { series: readonly DataDogMetricSeries[] } = { series: [] };
    await new DataDogMetricsExporter(buildDdClient(captured), inner).export();
    const s = captured.series.find((s) => s.metric === 'req');
    expect(s?.tags).toContain('service:api');
    expect(s?.tags).toContain('env:prod');
  });

  it('wraps postSeries errors in MetricsExportError', async () => {
    inner.incrementCounter('c');
    const exporter = new DataDogMetricsExporter(buildFailingDdClient(), inner);
    await expect(exporter.export()).rejects.toBeInstanceOf(MetricsExportError);
  });
});

// ---------------------------------------------------------------------------
// MetricsPort as interface (structural typing check)
// ---------------------------------------------------------------------------

describe('MetricsPort structural compliance', () => {
  it('InMemoryMetrics satisfies MetricsPort', () => {
    const port: MetricsPort = new InMemoryMetrics();
    port.incrementCounter('test');
    expect(port.getSnapshot().counters).toHaveLength(1);
  });

  it('CompositeMetrics satisfies MetricsPort', () => {
    const port: MetricsPort = new CompositeMetrics([new InMemoryMetrics()]);
    port.setGauge('g', 1);
    expect(port.getSnapshot().gauges).toHaveLength(1);
  });
});
