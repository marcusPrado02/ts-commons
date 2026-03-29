# @acme/features

Feature flags with targeting rules, rollout percentages, and A/B test variants. Evaluate flags based on user context without vendor lock-in.

## Installation

```bash
pnpm add @acme/features
```

## Quick Start

```typescript
import { FeatureService } from '@acme/features';

const service = new FeatureService(provider);

// Simple boolean flag
const isEnabled = await service.isEnabled('new-checkout', {
  userId: 'user-123',
  environment: 'production',
});

// Flag with variant (A/B test)
const variant = await service.getVariant('checkout-flow', {
  userId: 'user-123',
});
// variant.value === 'control' | 'treatment-a' | 'treatment-b'
```

## Evaluation

```typescript
import { evaluateTargeting, evaluateRollout } from '@acme/features';

// Targeting: evaluate rules directly
const match = evaluateTargeting(flag.rules, { plan: 'pro', country: 'BR' });

// Rollout: hash-based deterministic assignment
const inRollout = evaluateRollout(flag.rollout, 'user-123');
```

## Implementing a Provider

```typescript
import type { FeatureProviderPort, FeatureFlag } from '@acme/features';

class LaunchDarklyProvider implements FeatureProviderPort {
  async getFlag(key: string): Promise<FeatureFlag | null> {
    /* LD API */
  }
  async listFlags(): Promise<FeatureFlag[]> {
    /* LD API */
  }
}
```

## See Also

- [`@acme/config`](../config) — runtime configuration
- [`@acme/hotreload`](../hotreload) — hot-reload for flag sources
