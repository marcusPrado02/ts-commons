# @acme/web-graphql

GraphQL schema helpers, DataLoader factory, subscriptions, and federation utilities. Framework-agnostic — works with Apollo Server, Yoga, Mercurius, or any GraphQL runtime.

## Installation

```bash
pnpm add @acme/web-graphql
```

## Quick Start

```typescript
import { SchemaComposer, createDataLoader } from '@acme/web-graphql';

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
import { buildFederationServiceInfo } from '@acme/web-graphql';

const info = buildFederationServiceInfo({
  name: 'order-service',
  url: 'http://order-service/graphql',
  sdl: orderTypeDefs,
});
```

## Subscriptions

```typescript
import type { SubscriptionHandler, SubscriptionEvent } from '@acme/web-graphql';

const orderUpdated: SubscriptionHandler = {
  subscribe: (_, { orderId }) => pubSub.asyncIterator(`ORDER_UPDATED:${orderId}`),
  resolve: (event: SubscriptionEvent) => event.order,
};
```

## See Also

- [`@acme/web`](../web) — HTTP adapter base types
- [`@acme/bff`](../bff) — Backend-for-Frontend (REST + GraphQL)
