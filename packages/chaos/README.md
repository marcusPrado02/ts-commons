# @marcusprado02/chaos

Chaos engineering framework for resilience testing. Injects controlled failures — network partitions, service outages, resource exhaustion — to validate how your system behaves under stress.

## Installation

```bash
pnpm add @marcusprado02/chaos
```

## Quick Start

```typescript
import { ChaosMonkey, NetworkChaosExperiment } from '@marcusprado02/chaos';

const monkey = new ChaosMonkey({ enabled: process.env.NODE_ENV === 'test' });

// Inject a 200ms latency on 30% of calls
monkey.add(new NetworkChaosExperiment({ latencyMs: 200, probability: 0.3 }));

await monkey.wrap(async () => {
  return await orderService.create(order);
});
```

## Experiments

| Class                          | What it injects                                 |
| ------------------------------ | ----------------------------------------------- |
| `NetworkChaosExperiment`       | Latency, packet loss, DNS errors                |
| `ServiceFailureExperiment`     | Simulates a downstream service returning errors |
| `ResourceExhaustionExperiment` | Memory/CPU pressure simulation                  |

## Framework Mode

```typescript
import { ChaosExperimentFramework } from '@marcusprado02/chaos';

const framework = new ChaosExperimentFramework();
framework.schedule({ experiment: 'network', cron: '*/5 * * * *', durationMs: 60_000 });
const report = await framework.run();
```

## Safety

`ChaosMonkey` checks `enabled` before applying any fault. Set `enabled: false` in production to make all experiments no-ops without changing call sites.

## See Also

- [`@marcusprado02/resilience`](../resilience) — circuit breakers and retry policies
- [`@marcusprado02/synthetic`](../synthetic) — synthetic monitoring
