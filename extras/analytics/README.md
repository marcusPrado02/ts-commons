# @marcusprado02/analytics

Event tracking and product analytics. Unified port over Segment, Mixpanel, and Google Analytics 4 — swap providers without touching application code.

## Installation

```bash
pnpm add @marcusprado02/analytics
```

## Quick Start

```typescript
import { AnalyticsTracker, InMemoryProvider } from '@marcusprado02/analytics';

const tracker = new AnalyticsTracker(new InMemoryProvider());

// Identify a user
await tracker.identify({ userId: 'user-123', traits: { plan: 'pro' } });

// Track an event
await tracker.track({ event: 'Purchase', userId: 'user-123', properties: { amount: 99 } });

// Track a page view
await tracker.page({ userId: 'user-123', name: 'Checkout', url: '/checkout' });
```

## Providers

| Provider             | Import                     |
| -------------------- | -------------------------- |
| In-memory (dev/test) | `InMemoryProvider`         |
| Segment              | `SegmentProvider`          |
| Mixpanel             | `MixpanelProvider`         |
| Google Analytics 4   | `GoogleAnalytics4Provider` |

## Funnel Tracking

```typescript
import { FunnelTracker } from '@marcusprado02/analytics';

const funnels = new FunnelTracker(tracker);
const result = await funnels.track('signup', ['visit', 'register', 'verify'], userId);
// result.completionRate, result.steps
```

## Custom Dimensions

```typescript
import { CustomDimensionRegistry } from '@marcusprado02/analytics';

const dims = new CustomDimensionRegistry();
dims.register({ key: 'plan', label: 'Subscription Plan' });
```

## See Also

- [`@marcusprado02/observability`](../observability) — application-level metrics and logging
