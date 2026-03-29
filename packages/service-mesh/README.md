# @acme/service-mesh

Service mesh configuration builders for Istio and Linkerd. Generates typed `VirtualService`, `DestinationRule`, `PeerAuthentication`, and Linkerd `Server`/`ServerAuthorization` manifests from a unified API.

## Installation

```bash
pnpm add @acme/service-mesh
```

## Istio

```typescript
import {
  buildVirtualService,
  buildDestinationRule,
  buildPeerAuthentication,
} from '@acme/service-mesh';

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
import { buildServer, buildServerAuthorization } from '@acme/service-mesh';

const server = buildServer({ name: 'order-service', port: 3000, namespace: 'default' });
const auth = buildServerAuthorization({
  name: 'allow-payment-svc',
  server: 'order-service',
  namespace: 'default',
  allowedServiceAccounts: ['payment-service'],
});
```

## See Also

- [`@acme/k8s`](../k8s) — Kubernetes manifest builders
- [`@acme/resilience`](../resilience) — circuit breakers (application-level)
