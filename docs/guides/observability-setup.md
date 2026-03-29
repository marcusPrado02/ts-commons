# Observability Setup Guide

This guide shows how to wire `@acme/observability` into a service: structured logging, metrics, performance monitoring, and SLO tracking.

---

## Installation

```bash
pnpm add @acme/observability @acme/kernel
```

---

## Logging

### Basic Logger

```typescript
import { Logger } from '@acme/observability';

const logger = new Logger({ name: 'order-service' });

logger.info('Order confirmed', { orderId: 'ord-1', userId: 'usr-42' });
logger.warn('Stock low', { productId: 'prd-7', remaining: 3 });
logger.error('Payment failed', { orderId: 'ord-1', reason: 'Card declined' });
```

### LoggerFactory (named children)

```typescript
import { LoggerFactory } from '@acme/observability';

const factory = new LoggerFactory({ defaultLevel: 'info' });
const httpLogger = factory.create('http');
const dbLogger = factory.create('database');

httpLogger.info('GET /products', { statusCode: 200, durationMs: 12 });
dbLogger.debug('Query executed', { sql: 'SELECT ...', rows: 42 });
```

### Level filtering

```typescript
import { Logger, LevelFilterLogger, LogLevel } from '@acme/observability';

const base = new Logger({ name: 'svc' });
const filtered = new LevelFilterLogger(base, LogLevel.WARN); // only WARN and above
```

### PII redaction

```typescript
import { Logger, PiiRedactor } from '@acme/observability';

const redactor = new PiiRedactor(['email', 'creditCard', 'ssn']);
const logger = new Logger({ name: 'svc', redactor });

logger.info('User signed up', { email: 'alice@example.com' }); // → email: '[REDACTED]'
```

---

## Metrics

### InMemoryMetrics (development / testing)

```typescript
import { InMemoryMetrics } from '@acme/observability';

const metrics = new InMemoryMetrics();

metrics.incrementCounter('http.requests', { method: 'GET', path: '/products' });
metrics.setGauge('db.connections.active', 12);
metrics.recordHistogram('http.latency_ms', 45);

const snapshot = metrics.getSnapshot();
console.log(snapshot.counters); // [{ name, value, dimensions, ... }]
console.log(snapshot.gauges);
console.log(snapshot.histograms);
```

### Composite metrics (fan-out to multiple backends)

```typescript
import { CompositeMetrics, InMemoryMetrics } from '@acme/observability';

const local = new InMemoryMetrics();
const composite = new CompositeMetrics([local /*, grafana, datadog */]);

composite.incrementCounter('orders.created');
// Writes to every registered backend simultaneously
```

### Grafana / Prometheus push gateway

```typescript
import { GrafanaMetricsExporter } from '@acme/observability';
import type { PushGatewayClientLike } from '@acme/observability';

// Implement PushGatewayClientLike against your HTTP client
declare const pushGatewayClient: PushGatewayClientLike;

const exporter = new GrafanaMetricsExporter(pushGatewayClient, {
  jobName: 'order-service',
  flushIntervalMs: 10_000,
});
```

### DataDog

```typescript
import { DataDogMetricsExporter } from '@acme/observability';
import type { DataDogHttpClientLike } from '@acme/observability';

declare const ddClient: DataDogHttpClientLike;
const exporter = new DataDogMetricsExporter(ddClient, { apiKey: process.env.DD_API_KEY! });
```

---

## Performance Monitoring

### PerformanceMonitor

Tracks request timing, detects slow operations, and reports budget violations.

```typescript
import { PerformanceMonitor } from '@acme/observability';

const monitor = new PerformanceMonitor({
  slowQueryThresholdMs: 200,
  budgets: [{ name: 'http', maxP95Ms: 500 }],
});

const end = monitor.startRequest('GET /products');
// ... handle request ...
end(); // records timing

const report = monitor.getReport();
console.log(report.slowQueries);
console.log(report.budgetViolations);
```

### QueryProfiler

```typescript
import { QueryProfiler } from '@acme/observability';

const profiler = new QueryProfiler({ slowThresholdMs: 100 });

const done = profiler.start('SELECT * FROM orders WHERE status = $1');
// ... run query ...
const profile = done();
// profile.durationMs, profile.slow, profile.query
```

### RequestTimingCollector

```typescript
import { RequestTimingCollector } from '@acme/observability';

const collector = new RequestTimingCollector();

// Middleware-style usage
app.use((req, res, next) => {
  const finish = collector.record(req.method, req.path);
  res.on('finish', () => finish(res.statusCode));
  next();
});
```

---

## SLO / SLI Tracking

```typescript
import { SliTracker, SloTracker, AvailabilitySli } from '@acme/observability';
import type { SloConfig } from '@acme/observability';

const sloConfig: SloConfig = {
  name: 'api-availability',
  target: 0.999,
  windowDays: 30,
};

const sliTracker = new SliTracker(new AvailabilitySli());
const sloTracker = new SloTracker(sloConfig, sliTracker);

// Record requests
sliTracker.record({ success: true });
sliTracker.record({ success: false }); // failure

const status = sloTracker.getStatus();
console.log(status.errorBudgetRemaining); // fraction remaining
console.log(status.burnRateAlerts); // active burn rate alerts
```

---

## Memory Profiling

```typescript
import { MemoryLeakDetector, MemoryAlertManager } from '@acme/observability';

// Alert when heap exceeds 512 MB
const alertManager = new MemoryAlertManager([
  { name: 'high-heap', thresholdBytes: 512 * 1024 * 1024 },
]);

const snapshot = alertManager.check();
if (snapshot.alerts.length > 0) {
  console.warn('Memory alerts', snapshot.alerts);
}

// Leak detection
const detector = new MemoryLeakDetector({ growthThresholdBytes: 10 * 1024 * 1024 });
detector.takeSample();
// ... later ...
detector.takeSample();
const leaks = detector.getLeaks();
```

---

## Recommended wiring pattern

Wire observability into your DI root once, then inject into handlers:

```typescript
import { LoggerFactory, InMemoryMetrics, CompositeMetrics } from '@acme/observability';

// Composition root
const loggers = new LoggerFactory({ defaultLevel: 'info' });
const metrics = new InMemoryMetrics(); // swap for Grafana/DataDog in production

// Pass to handlers
const handler = new CreateOrderHandler(repo, loggers.create('order'), metrics);
```

For production, replace `InMemoryMetrics` with a `CompositeMetrics` that fans out to your metrics backend — no handler changes required.
