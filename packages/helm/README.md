# @acme/helm

Helm chart values builder and release command generator. Produces typed `HelmValues` objects and validated `helm upgrade --install` commands from code.

## Installation

```bash
pnpm add -D @acme/helm
```

## Quick Start

```typescript
import { ValuesBuilder, buildReleaseCommands } from '@acme/helm';

const values = new ValuesBuilder('order-service')
  .image({ repository: 'registry.acme.com/order-service', tag: '1.2.3' })
  .replicas(3)
  .resources({ cpu: '200m', memory: '256Mi' })
  .service({ port: 3000, type: 'ClusterIP' })
  .liveness('/health/live')
  .readiness('/health/ready')
  .autoscaling({ minReplicas: 2, maxReplicas: 10, targetCpuPercent: 70 })
  .build();

const commands = buildReleaseCommands({
  release: 'order-service',
  chart: './charts/microservice',
  namespace: 'default',
  values,
});
// commands.install, commands.upgrade, commands.rollback
```

## Chart Validation

```typescript
import { validateValues } from '@acme/helm';

const result = validateValues(values);
// result.valid, result.errors
```

## See Also

- [`@acme/k8s`](../k8s) — Kubernetes manifest builders
- [`@acme/terraform`](../terraform) — infrastructure as code
