# @marcusprado02/web-graphql

GraphQL schema helpers, DataLoader factory, subscriptions, and federation utilities. Framework-agnostic — works with Apollo Server, Yoga, Mercurius, or any GraphQL runtime.

## Installation

```bash
pnpm add @marcusprado02/web-graphql
```

## Quick Start

```typescript
import { SchemaComposer, createDataLoader } from '@marcusprado02/web-graphql';

// Compose SDL fragments into a unified schema
const composer = new SchemaComposer();
composer.add(userFragment);
composer.add(orderFragment);
const schema = composer.build();

// DataLoader for N+1 prevention
const userLoader = createDataLoader<string, User>(
  async (userIds) => userService.findManyByIds(userIds),
  { cache: true, maxBatchSize: 100 },
);
```

## Federation

```typescript
import { buildFederationServiceInfo } from '@marcusprado02/web-graphql';

const info = buildFederationServiceInfo({
  name: 'order-service',
  url: 'http://order-service/graphql',
  sdl: orderTypeDefs,
});
```

## Subscriptions

```typescript
import type { SubscriptionHandler, SubscriptionEvent } from '@marcusprado02/web-graphql';

const orderUpdated: SubscriptionHandler = {
  subscribe: (_, { orderId }) => pubSub.asyncIterator(`ORDER_UPDATED:${orderId}`),
  resolve: (event: SubscriptionEvent) => event.order,
};
```

## See Also

- [`@marcusprado02/web`](../web) — HTTP adapter base types
- [`@marcusprado02/bff`](../bff) — Backend-for-Frontend (REST + GraphQL)
