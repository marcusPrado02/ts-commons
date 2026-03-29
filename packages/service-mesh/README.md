# @marcusprado02/service-mesh

Service mesh configuration builders for Istio and Linkerd. Generates typed `VirtualService`, `DestinationRule`, `PeerAuthentication`, and Linkerd `Server`/`ServerAuthorization` manifests from a unified API.

## Installation

```bash
pnpm add @marcusprado02/service-mesh
```

## Istio

```typescript
import {
  buildVirtualService,
  buildDestinationRule,
  buildPeerAuthentication,
} from '@marcusprado02/service-mesh';

// Traffic management: weighted routing for canary
const vs = buildVirtualService({
  name: 'order-service',
  namespace: 'default',
  routes: [
    { destination: 'order-service-v2', weight: 10 },
    { destination: 'order-service-v1', weight: 90 },
  ],
  retryPolicy: { attempts: 3, perTryTimeoutMs: 2000 },
});

// mTLS peer authentication
const mtls = buildPeerAuthentication({
  name: 'order-service-mtls',
  namespace: 'default',
  mode: 'STRICT',
});
```

## Linkerd

```typescript
import { buildServer, buildServerAuthorization } from '@marcusprado02/service-mesh';

const server = buildServer({ name: 'order-service', port: 3000, namespace: 'default' });
const auth = buildServerAuthorization({
  name: 'allow-payment-svc',
  server: 'order-service',
  namespace: 'default',
  allowedServiceAccounts: ['payment-service'],
});
```

## See Also

- [`@marcusprado02/k8s`](../k8s) — Kubernetes manifest builders
- [`@marcusprado02/resilience`](../resilience) — circuit breakers (application-level)
