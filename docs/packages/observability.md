# @acme/observability

Structured logging, metrics, distributed tracing, SLO tracking, and performance monitoring — all following the Port/Adapter pattern.

**Install:** `pnpm add @acme/observability @acme/kernel`

**OpenTelemetry tracing:** `pnpm add @acme/observability-otel`

---

## `LoggerFactory` — Structured Logging

```typescript
import { LoggerFactory, LogLevel } from '@acme/observability';

const factory = new LoggerFactory({
  level: LogLevel.INFO,
  pretty: process.env.NODE_ENV !== 'production', // pretty-print in dev
});

// Create a logger per module — adds "module" tag to every line
const log = factory.create('OrderService');

log.info('Order placed', { orderId, customerId, total });
log.warn('Stock low', { productId, remaining: 3 });
log.error('Payment failed', { error: err.message, orderId });
log.debug('Fetching order', { orderId });
```

All log lines automatically include: `correlationId`, `tenantId`, `timestamp`, `level`, `module`.

---

## `PiiRedactor` — Safe Logging

Redacts sensitive fields before they reach the log output.

```typescript
import { PiiRedactor } from '@acme/observability';

const redactor = new PiiRedactor({
  fields: ['password', 'creditCard', 'cpf', 'email', 'token'],
  strategy: 'replace', // 'replace' → "[REDACTED]", 'hash' → sha256 hash
});

const log = factory.create('AuthService', { redactor });

log.info('Login attempt', {
  email: 'user@example.com', // → "[REDACTED]"
  password: 'secret123', // → "[REDACTED]"
  ip: '192.168.1.1', // untouched
});
```

---

## `MetricsPort` and Exporters

```typescript
import { MetricsPort, InMemoryMetrics } from '@acme/observability';

// In production: DataDogMetrics, GrafanaMetrics, OtelMetrics, etc.
const metrics: MetricsPort = new InMemoryMetrics();

// Increment a counter
metrics.increment('orders.placed', { currency: 'BRL', region: 'us-east-1' });

// Set a gauge (current value)
metrics.gauge('orders.queue.size', 42);

// Record a histogram value (distribution)
metrics.histogram('orders.processing.duration_ms', 230, { status: 'success' });

// Record timing from a start time
const start = Date.now();
await processOrder();
metrics.timing('payment.latency', start, { provider: 'stripe' });
```

---

## `OtelTracer` — Distributed Tracing (OpenTelemetry)

```typescript
import { OtelTracer } from '@acme/observability-otel';

const tracer = new OtelTracer({ serviceName: 'orders-service' });

const span = tracer.startSpan('PlaceOrderUseCase.execute');
try {
  span.setAttribute('order.id', orderId);
  span.setAttribute('customer.id', customerId);

  const result = await placeOrder(input);

  span.setAttribute('order.total', result.unwrap().total);
  span.setStatus('ok');
} catch (err) {
  span.recordException(err as Error);
  span.setStatus('error');
  throw err;
} finally {
  span.end();
}
```

---

## `AdvancedTracer` — Dependency Analysis

```typescript
import { AdvancedTracer } from '@acme/observability-otel';

const tracer = new AdvancedTracer({
  strategy: 'ratio',
  ratio: 0.1, // sample 10% of requests
});

// Propagate context to outgoing HTTP calls
tracer.inject(ctx, outgoingHeaders);

// Extract context from incoming HTTP calls
const ctx = tracer.extract(request.headers);

// Record a span manually
tracer.recordSpan({
  name: 'db.query.findOrder',
  durationMs: 45,
  status: 'ok',
  attributes: { 'db.statement': 'SELECT * FROM orders WHERE id = $1' },
});

// Analyse recorded spans
const deps = tracer.getServiceDependencies();
// [{ from: 'orders-service', to: 'postgres', callCount: 150, errorCount: 2 }]

const criticalPath = tracer.getCriticalPath(traceId);
// Sorted list of spans from longest to shortest duration
```

---

## `SloTracker` — SLO and Error Budget

```typescript
import { SloTracker } from '@acme/observability';

const slo = new SloTracker({
  name: 'orders-availability',
  targetPercent: 99.9,
  windowDays: 30,
});

// Record each outcome
slo.record({ success: true, latencyMs: 120 });
slo.record({ success: false, latencyMs: 5000 });

const budget = slo.errorBudgetRemaining();
// { percent: 0.08, minutes: 34.5, requestsAllowed: 720 }

const report = slo.getReport();
// { target: 99.9, actual: 99.92, breached: false, windowDays: 30 }
```

---

## `PerformanceMonitor` — Latency Tracking

```typescript
import { PerformanceMonitor } from '@acme/observability';

const monitor = new PerformanceMonitor({ p99ThresholdMs: 500 });

await monitor.track('PlaceOrder', async () => {
  return await placeOrderUseCase.execute(input);
});

const report = monitor.getReport('PlaceOrder');
// { p50: 45, p95: 210, p99: 480, max: 1200, count: 10000 }

const slow = monitor.getSlowOperations(); // operations where p99 > threshold
```

---

## Correlation IDs in Logs

When using `@acme/web-fastify`, the `CorrelationHook` automatically injects `correlationId` into every request. The logger reads from `CorrelationContext` automatically.

```typescript
// All log lines in this request will include correlationId
// e.g. { "level": "info", "correlationId": "abc-123", "message": "Order placed" }
```

---

## Summary

| Export               | Package              | Purpose                                      |
| -------------------- | -------------------- | -------------------------------------------- |
| `LoggerFactory`      | `observability`      | Factory for module-scoped structured loggers |
| `LogLevel`           | `observability`      | Enum: DEBUG, INFO, WARN, ERROR               |
| `PiiRedactor`        | `observability`      | Redact PII fields from log objects           |
| `MetricsPort`        | `observability`      | Port — counter, gauge, histogram, timing     |
| `InMemoryMetrics`    | `observability`      | In-memory metrics for testing                |
| `SloTracker`         | `observability`      | SLO compliance and error budget tracking     |
| `PerformanceMonitor` | `observability`      | p50/p95/p99 latency tracking                 |
| `OtelTracer`         | `observability-otel` | OpenTelemetry span management                |
| `AdvancedTracer`     | `observability-otel` | Sampling, dependency graph, critical path    |
