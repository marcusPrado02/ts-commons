# @acme/timeseries

Time-series data adapters for InfluxDB and TimescaleDB. Provides write, query, aggregation, downsampling, and retention policy management behind a unified `TimeSeriesAdapter` interface.

## Installation

```bash
pnpm add @acme/timeseries
```

## Quick Start

```typescript
import { InfluxDBAdapter } from '@acme/timeseries';
import type { InfluxDBConfig } from '@acme/timeseries';

const config: InfluxDBConfig = {
  url: 'http://localhost:8086',
  token: process.env.INFLUX_TOKEN!,
  org: 'acme',
  bucket: 'metrics',
};

const adapter = new InfluxDBAdapter(config);

// Write data points
await adapter.write([
  {
    measurement: 'order_latency',
    tags: { service: 'order-svc' },
    fields: { p99: 42 },
    timestamp: new Date(),
  },
]);

// Query a time range
const points = await adapter.query({
  measurement: 'order_latency',
  start: new Date(Date.now() - 3_600_000), // last hour
  end: new Date(),
});
```

## Aggregation & Downsampling

```typescript
import { AggregationEngine, Downsampler } from '@acme/timeseries';

const engine = new AggregationEngine(adapter);
const result = await engine.aggregate({
  measurement: 'order_latency',
  fn: 'p99',
  bucketMs: 60_000, // 1-minute buckets
  range: { start, end },
});

const downsampler = new Downsampler(adapter);
await downsampler.downsample({ sourceBucket: 'raw', targetBucket: '1h', algorithm: 'lttb' });
```

## See Also

- [`@acme/observability`](../observability) — application metrics
- [`@acme/geospatial`](../geospatial) — spatial data
