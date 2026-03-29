# @acme/k8s

Kubernetes manifest builders and client helpers. Generates typed Deployment, Service, ConfigMap, HPA, PDB, and Ingress specs; watches ConfigMaps at runtime; and manages blue-green/canary deployments.

## Installation

```bash
pnpm add @acme/k8s
```

## Quick Start

```typescript
import { buildDeployment, buildService } from '@acme/k8s';

const deployment = buildDeployment({
  name: 'order-service',
  namespace: 'default',
  image: 'registry.acme.com/order-service:1.2.3',
  replicas: 3,
  port: 3000,
  resources: { cpu: '200m', memory: '256Mi' },
  livenessPath: '/health/live',
  readinessPath: '/health/ready',
});

const service = buildService({
  name: 'order-service',
  namespace: 'default',
  port: 3000,
  type: 'ClusterIP',
});
```

## Manifest Builders

| Builder           | Manifest kind             |
| ----------------- | ------------------------- |
| `buildDeployment` | `Deployment`              |
| `buildService`    | `Service`                 |
| `buildConfigMap`  | `ConfigMap`               |
| `buildHPA`        | `HorizontalPodAutoscaler` |
| `buildPDB`        | `PodDisruptionBudget`     |
| `buildIngress`    | `Ingress`                 |

## Canary Deployments

```typescript
import { CanaryRelease } from '@acme/k8s';

const canary = new CanaryRelease(metricsProvider);
await canary.promote(); // Increases traffic weight by stepSize
await canary.rollback(); // Cuts traffic back to 0%
```

## See Also

- [`@acme/docker-utils`](../docker-utils) — graceful shutdown and health aggregation
- [`@acme/helm`](../helm) — Helm chart templates
