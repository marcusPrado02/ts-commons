# @marcusprado02/observability

Structured logging, business metrics, SLO tracking, and PII redaction. Zero framework dependencies — works with any transport via `MetricsPort`.

## Installation

```bash
pnpm add @marcusprado02/observability
```

## Logging

```typescript
import { LoggerFactory } from '@marcusprado02/observability';

const factory = new LoggerFactory({ level: 'info', pretty: process.env.NODE_ENV !== 'production' });
const logger = factory.create('order-service');

logger.info('Order created', { orderId: 'ord-123', userId: 'usr-456' });
logger.error('Payment failed', { error, orderId: 'ord-123' });
```

## Metrics

```typescript
import { InMemoryMetrics } from '@marcusprado02/observability';
import type { MetricsPort } from '@marcusprado02/observability';

const metrics: MetricsPort = new InMemoryMetrics();
metrics.counter('orders.created').increment({ status: 'success' });
metrics.histogram('order.latency_ms').record(42);
metrics.gauge('queue.depth').set(17);

// Export to Grafana / DataDog
import { GrafanaMetricsExporter } from '@marcusprado02/observability';
const exporter = new GrafanaMetricsExporter({ endpoint: 'http://pushgateway:9091' }, metrics);
await exporter.push();
```

## PII Redaction

```typescript
import { PiiRedactor } from '@marcusprado02/observability';

const redactor = new PiiRedactor({ fields: ['email', 'cpf', 'phone'] });
const safe = redactor.redact({ email: 'user@example.com', name: 'Alice' });
// { email: '[REDACTED]', name: 'Alice' }
```

## SLO Tracking

```typescript
import { SloTracker } from '@marcusprado02/observability';

const slo = new SloTracker({ target: 0.999, windowDays: 30 });
slo.record({ success: true, latencyMs: 45 });
const budget = slo.errorBudgetRemaining(); // 0.0003
```

## See Also

- [`@marcusprado02/observability-otel`](../observability-otel) — OpenTelemetry tracing + metrics
- [`@marcusprado02/audit`](../audit) — audit trail
