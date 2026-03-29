# @acme/bff

Backend-for-Frontend (BFF) pattern implementation. Aggregates multiple service calls into a single tailored response, with support for REST and GraphQL client types.

## Installation

```bash
pnpm add @acme/bff
```

## Quick Start

```typescript
import { ServiceAggregator, RestBff, createBffResponse } from '@acme/bff';

const aggregator = new ServiceAggregator();

// Register services to aggregate
aggregator.add('user', () => userService.getById(userId));
aggregator.add('orders', () => orderService.listByUser(userId));

const bff = new RestBff(aggregator);
const response = await bff.aggregate({ clientType: 'mobile', requestId: 'req-1' });
// response.data = { user: {...}, orders: [...] }
```

## API

| Export                   | Description                                                |
| ------------------------ | ---------------------------------------------------------- |
| `ServiceAggregator`      | Runs multiple service calls in parallel and merges results |
| `RestBff`                | BFF tailored for REST clients                              |
| `GraphQlBff`             | BFF tailored for GraphQL clients with field selection      |
| `BffRouter`              | Routes incoming requests to the right BFF implementation   |
| `ResponseShaperRegistry` | Registers response shaper strategies per client type       |
| `createBffResponse`      | Factory for a typed `BffResponse<T>`                       |

## Client Types

`ClientType` discriminates between `'mobile'`, `'web'`, and `'desktop'` — the BFF uses this to shape the response (e.g. trimming heavy fields for mobile).

## See Also

- [`@acme/gateway`](../gateway) — API gateway routing
- [`@acme/web`](../web) — HTTP adapter base types
