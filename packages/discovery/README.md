# @marcusprado02/discovery

Service discovery abstraction. Registers, deregisters, and resolves service instances with configurable load balancing strategies. Ships with an in-memory implementation for testing and adapters for Consul/Eureka.

## Installation

```bash
pnpm add @marcusprado02/discovery
```

## Quick Start

```typescript
import {
  InMemoryServiceRegistry,
  RoundRobinBalancer,
  HealthChecker,
} from '@marcusprado02/discovery';

const registry = new InMemoryServiceRegistry();

// Register a service instance
await registry.register({
  id: 'order-svc-1',
  name: 'order-service',
  host: '10.0.0.1',
  port: 3000,
  tags: ['v2'],
});

// Resolve with load balancing
const balancer = new RoundRobinBalancer(registry);
const instance = await balancer.pick('order-service');
// instance.host, instance.port
```

## Load Balancers

| Strategy          | Class                      |
| ----------------- | -------------------------- |
| Round-robin       | `RoundRobinBalancer`       |
| Random            | `RandomBalancer`           |
| Least connections | `LeastConnectionsBalancer` |

## Health Checks

```typescript
const checker = new HealthChecker(registry, {
  interval: 10_000,
  timeout: 2_000,
  unhealthyThreshold: 3,
});

checker.start();
// Automatically marks instances as unhealthy after failed checks
```

## Implementing a Custom Backend

```typescript
import type { ServiceRegistry } from '@marcusprado02/discovery';

class ConsulRegistry implements ServiceRegistry {
  async register(instance: ServiceInstance): Promise<void> {
    /* Consul API */
  }
  async deregister(id: string): Promise<void> {
    /* Consul API */
  }
  async resolve(name: string): Promise<ServiceInstance[]> {
    /* Consul API */
  }
}
```

## See Also

- [`@marcusprado02/resilience`](../resilience) — circuit breakers and retries
- [`@marcusprado02/docker-utils`](../docker-utils) — health endpoints for K8s
