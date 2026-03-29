# @acme/observability

Structured logging, business metrics, SLO tracking, and PII redaction. Zero framework dependencies — works with any transport via `MetricsPort`.

## Installation

```bash
pnpm add @acme/observability
```

## Logging

```typescript
import { LoggerFactory } from '@acme/observability';

const factory = new LoggerFactory({ level: 'info', pretty: process.env.NODE_ENV !== 'production' });
const logger = factory.create('order-service');

logger.info('Order created', { orderId: 'ord-123', userId: 'usr-456' });
logger.error('Payment failed', { error, orderId: 'ord-123' });
```

## Metrics

```typescript
import { InMemoryMetrics } from '@acme/observability';
import type { MetricsPort } from '@acme/observability';

const metrics: MetricsPort = new InMemoryMetrics();
metrics.counter('orders.created').increment({ status: 'success' });
metrics.histogram('order.latency_ms').record(42);
metrics.gauge('queue.depth').set(17);

// Export to Grafana / DataDog
import { GrafanaMetricsExporter } from '@acme/observability';
const exporter = new GrafanaMetricsExporter({ endpoint: 'http://pushgateway:9091' }, metrics);
await exporter.push();
```

## PII Redaction

```typescript
import { PiiRedactor } from '@acme/observability';

const redactor = new PiiRedactor({ fields: ['email', 'cpf', 'phone'] });
const safe = redactor.redact({ email: 'user@example.com', name: 'Alice' });
// { email: '[REDACTED]', name: 'Alice' }
```

## SLO Tracking

```typescript
import { SloTracker } from '@acme/observability';

const slo = new SloTracker({ target: 0.999, windowDays: 30 });
slo.record({ success: true, latencyMs: 45 });
const budget = slo.errorBudgetRemaining(); // 0.0003
```

## See Also

- [`@acme/observability-otel`](../observability-otel) — OpenTelemetry tracing + metrics
- [`@acme/audit`](../audit) — audit trail
