# @acme/synthetic

Synthetic monitoring and canary checks. Runs API health probes and multi-step user journey simulations, then alerts when checks fail or latency exceeds thresholds.

## Installation

```bash
pnpm add @acme/synthetic
```

## API Health Checks

```typescript
import { SyntheticMonitor } from '@acme/synthetic';

const monitor = new SyntheticMonitor();

monitor.addCheck({
  name: 'checkout-api',
  url: 'https://api.acme.com/health',
  method: 'GET',
  expectedStatus: 200,
  timeoutMs: 3000,
  alertConfig: { channel: 'pagerduty', threshold: 2 },
});

const results = await monitor.runAll();
// results[n].passed, results[n].latencyMs, results[n].statusCode
```

## User Journey Simulation

```typescript
const journey = monitor.addJourney('checkout-flow', [
  {
    name: 'load product page',
    run: async () => {
      await fetch('https://acme.com/products/123');
    },
  },
  {
    name: 'add to cart',
    run: async () => {
      await cartService.add('product-123');
    },
  },
  {
    name: 'checkout',
    run: async () => {
      await checkoutService.complete(cartId);
    },
  },
]);

const result = await monitor.runJourney('checkout-flow');
// result.passed, result.totalDurationMs, result.failedStep
```

## See Also

- [`@acme/incidents`](../incidents) — incident management on check failure
- [`@acme/chaos`](../chaos) — chaos engineering
- [`@acme/resilience`](../resilience) — circuit breakers
