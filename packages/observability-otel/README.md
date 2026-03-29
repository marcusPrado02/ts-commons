# @acme/observability-otel

OpenTelemetry adapters for `@acme/observability`. Provides OTLP-compatible tracing (`OtelTracer`) and metrics (`OtelMetrics`) without forcing a dependency on `@opentelemetry/api` in application code.

## Installation

```bash
pnpm add @acme/observability-otel @opentelemetry/api @opentelemetry/sdk-node
```

## Quick Start

```typescript
import { OtelTracer, OtelMetrics } from '@acme/observability-otel';
import { NodeSDK } from '@opentelemetry/sdk-node';

const sdk = new NodeSDK({
  /* your OTLP exporter */
});
sdk.start();

const tracer = new OtelTracer('order-service');
const span = tracer.startSpan('process-order', { orderId: 'ord-123' });
try {
  await processOrder(order);
  span.end();
} catch (err) {
  span.recordError(err);
  span.end();
}
```

## Advanced Tracing

```typescript
import { AdvancedTracer } from '@acme/observability-otel';

const tracer = new AdvancedTracer('order-service', {
  sampling: { strategy: 'probability', rate: 0.1 },
});

const deps = tracer.getServiceDependencies();
const criticalPath = tracer.getCriticalPath(traceId);
```

## No-op Adapters

For testing or environments without OpenTelemetry configured:

```typescript
import { NoopTracer, NoopMetrics } from '@acme/observability-otel';

const tracer = new NoopTracer(); // All operations are silent no-ops
```

## See Also

- [`@acme/observability`](../observability) — logging and metrics port
- [`@acme/audit`](../audit) — audit trail
