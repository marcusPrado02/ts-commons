# @acme/docker-utils

Kubernetes-ready shutdown and health checks. Implements 12-Factor Factor IX (Disposability): fast startup, graceful shutdown, and proper liveness/readiness signals.

**Install:** `pnpm add @acme/docker-utils @acme/kernel`

---

## `GracefulShutdown`

Handles `SIGTERM` and `SIGINT`. Executes registered cleanup handlers in reverse registration order (last in, first out) within a configurable timeout.

```typescript
import { GracefulShutdown } from '@acme/docker-utils';

const shutdown = new GracefulShutdown({ timeoutMs: 30_000 });

// Register cleanup handlers (called in reverse order on SIGTERM/SIGINT)
// Best practice: stop accepting traffic first, then drain in-flight, then close connections
shutdown.register('http-server', async () => {
  await app.close();
});
shutdown.register('kafka-consumer', async () => {
  await consumer.stop();
});
shutdown.register('outbox-relay', async () => {
  await relay.stop();
});
shutdown.register('scheduler', async () => {
  await scheduler.stop();
});
shutdown.register('redis', async () => {
  await redis.disconnect();
});
shutdown.register('kafka-producer', async () => {
  await kafka.disconnect();
});
shutdown.register('db-connection', async () => {
  await prisma.$disconnect();
});

// Start listening for OS signals
shutdown.listen();
```

If any cleanup handler throws or the overall timeout is exceeded, the process exits with code `1`.

---

## `HealthAggregator` — Health Checks

Aggregates multiple health checks into a single endpoint. Supports both liveness (`/health`) and readiness (`/health/ready`) probes.

```typescript
import { HealthAggregator } from '@acme/docker-utils';

const health = new HealthAggregator();

// Register individual checks
health.register('database', async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { status: 'UP' };
});

health.register('kafka', async () => {
  const connected = await kafkaConnection.ping();
  return { status: connected ? 'UP' : 'DOWN' };
});

health.register('redis', async () => {
  await redisClient.ping();
  return { status: 'UP' };
});

health.register(
  'external-api',
  async () => {
    const ok = await externalApi.healthCheck();
    return {
      status: ok ? 'UP' : 'DOWN',
      details: { latencyMs: ok.latency },
    };
  },
  { critical: false },
); // non-critical — won't fail the overall status
```

### Fastify Endpoints

```typescript
// Liveness probe — is the process alive?
app.get('/health', async (_, reply) => {
  const result = await health.check();
  reply.status(result.status === 'UP' ? 200 : 503).send(result);
});

// Readiness probe — is the service ready to receive traffic?
app.get('/health/ready', async (_, reply) => {
  const result = await health.checkReady();
  reply.status(result.status === 'UP' ? 200 : 503).send(result);
});
```

### Response Format

```json
{
  "status": "UP",
  "checks": {
    "database": { "status": "UP" },
    "kafka": { "status": "UP" },
    "redis": { "status": "UP" },
    "external-api": { "status": "DOWN", "details": { "latencyMs": 5000 } }
  }
}
```

If any **critical** check is `DOWN`, the overall `status` is `DOWN`.

---

## Kubernetes Configuration

Typical Kubernetes probe configuration for a ts-commons service:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 3

terminationGracePeriodSeconds: 35 # slightly more than shutdown.timeoutMs (30s)
```

---

## Summary

| Export              | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `GracefulShutdown`  | SIGTERM/SIGINT handler with ordered cleanup |
| `HealthAggregator`  | Aggregate multiple health checks            |
| `HealthCheckResult` | Response type `{ status, checks }`          |
