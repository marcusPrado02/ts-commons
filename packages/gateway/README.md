# @acme/gateway

API gateway configuration builders for Kong, AWS API Gateway, and Azure API Management (APIM). Generates validated provider-specific configuration objects from a unified `GatewayRouteConfig`.

## Installation

```bash
pnpm add @acme/gateway
```

## Quick Start

```typescript
import { buildKongService, buildKongRateLimitPlugin, validateRateLimit } from '@acme/gateway';

const service = buildKongService({
  name: 'order-service',
  url: 'http://order-service:3000',
  routes: [{ paths: ['/api/orders'], methods: ['GET', 'POST'] }],
});

const rateLimit = buildKongRateLimitPlugin({ requestsPerMinute: 1000 });

// Validate before applying
const validation = validateRateLimit({ requestsPerMinute: 0 }); // { valid: false, errors: [...] }
```

## Supported Providers

| Provider        | Builders                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| Kong            | `buildKongService`, `buildKongRateLimitPlugin`, `buildKongKeyAuthPlugin`, `buildKongRequestTransformPlugin` |
| AWS API Gateway | `buildRestApiSpec`, `buildUsagePlan`, `buildApiKeyResource`, `buildStageConfig`                             |
| Azure APIM      | `buildApimPolicy`, `buildProductConfig`, `buildApiConfig`                                                   |

## See Also

- [`@acme/bff`](../bff) — Backend-for-Frontend aggregation
- [`@acme/web`](../web) — HTTP adapter base types
