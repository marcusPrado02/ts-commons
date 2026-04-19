# @marcusprado02/bff

Backend-for-Frontend (BFF) pattern implementation. Aggregates multiple service calls into a single tailored response, with support for REST and GraphQL client types.

## Installation

```bash
pnpm add @marcusprado02/bff
```

## Quick Start

```typescript
import { ServiceAggregator, RestBff, createBffResponse } from '@marcusprado02/bff';

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

- [`@marcusprado02/gateway`](../gateway) — API gateway routing
- [`@marcusprado02/web`](../web) — HTTP adapter base types
