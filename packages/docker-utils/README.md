# @acme/docker-utils

Container runtime utilities: graceful shutdown, health aggregation, and Kubernetes liveness/readiness endpoints. Works with any HTTP framework.

## Installation

```bash
pnpm add @acme/docker-utils
```

## Quick Start

```typescript
import { GracefulShutdown, HealthAggregator, HealthCheckHandler } from '@acme/docker-utils';

// Graceful shutdown on SIGTERM / SIGINT
const shutdown = new GracefulShutdown({ timeoutMs: 10_000 });
shutdown.register(() => db.disconnect());
shutdown.register(() => kafkaConsumer.stop());
shutdown.listen(); // attaches process signal handlers

// Health aggregation
const health = new HealthAggregator();
health.register('database', () => db.ping().then(() => ({ status: 'healthy' })));
health.register('cache', () => redis.ping().then(() => ({ status: 'healthy' })));

// HTTP handler (framework-agnostic)
const handler = new HealthCheckHandler(health);
app.get('/health', (req, res) => handler.handle(req, res));
app.get('/health/live', (req, res) => handler.liveness(req, res));
app.get('/health/ready', (req, res) => handler.readiness(req, res));
```

## K8s Probe Endpoints

| Path                | Probe                                             |
| ------------------- | ------------------------------------------------- |
| `GET /health`       | Full report with all checks                       |
| `GET /health/live`  | Liveness — returns 200 if the process is running  |
| `GET /health/ready` | Readiness — returns 200 only when all checks pass |

## See Also

- [`@acme/k8s`](../k8s) — Kubernetes client helpers
- [`@acme/resilience`](../resilience) — circuit breakers
- [`@acme/observability`](../observability) — metrics and logging
