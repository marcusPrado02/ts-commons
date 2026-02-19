# @acme/secrets

Secrets management port and adapters for Clean Architecture — read, write, rotate,
and cache secrets from any backend without coupling your domain to a specific provider.

---

## Features

- **`SecretsPort`** — Core interface: `get` / `set` / `delete` / `rotate`
- **`EnvSecretsAdapter`** — Reads from `process.env`; perfect for local dev and testing
- **`CachedSecretsAdapter`** — In-memory TTL cache decorator over any `SecretsPort`
- **`FallbackSecretsAdapter`** — Tries a prioritised chain of adapters; write-through to all
- **`AwsSsmSecretsAdapter`** — AWS SSM Parameter Store via structural `AwsSsmClientLike` (no SDK import)
- **Structural interfaces** — `AwsSsmClientLike` lets you cast any compatible client without a hard dep
- TypeScript strict mode (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) ✅
- ESLint compliant ✅

---

## Architecture

```
Domain / Application Layer
  └── SecretsPort (interface)

Infrastructure Layer
  └── EnvSecretsAdapter       — process.env (no external deps)
  └── CachedSecretsAdapter    — TTL cache decorator (wraps any SecretsPort)
  └── FallbackSecretsAdapter  — ordered adapter chain
  └── AwsSsmSecretsAdapter    — AWS SSM Parameter Store
           ↑
      AwsSsmClientLike (structural interface)
           ↑
      @aws-sdk/client-ssm (cast via as unknown as AwsSsmClientLike)
```

---

## Installation

```bash
pnpm add @acme/secrets
# For AWS SSM adapter:
pnpm add @aws-sdk/client-ssm
```

`@aws-sdk/client-ssm` is an **optional peer dependency** — only required when using `AwsSsmSecretsAdapter`.

---

## Quick Start

### 1. Environment secrets (dev / test)

```typescript
import { EnvSecretsAdapter } from '@acme/secrets';

const secrets = new EnvSecretsAdapter();

// Read
const dbPassword = await secrets.get('DB_PASSWORD');
dbPassword.match({
  some: (value) => console.log('password:', value),
  none: () => console.warn('DB_PASSWORD not set'),
});

// Write  (mutates process.env)
await secrets.set('API_KEY', 'tok-abc-123');

// Delete
await secrets.delete('OLD_FLAG');
```

### 2. AWS SSM Parameter Store

```typescript
import { SSMClient } from '@aws-sdk/client-ssm';
import { AwsSsmSecretsAdapter } from '@acme/secrets';
import type { AwsSsmClientLike } from '@acme/secrets';

const client  = new SSMClient({ region: 'us-east-1' });
const secrets = new AwsSsmSecretsAdapter(
  client as unknown as AwsSsmClientLike,
  '/myapp/prod',          // optional key prefix
);

await secrets.set('DB_PASSWORD', 's3cr3t!');
const result = await secrets.get('DB_PASSWORD');
// → Option.some('s3cr3t!')  (stored as /myapp/prod/DB_PASSWORD)
```

### 3. Caching with TTL

```typescript
import { CachedSecretsAdapter, AwsSsmSecretsAdapter } from '@acme/secrets';
import { Duration } from '@acme/kernel';

const ssm    = new AwsSsmSecretsAdapter(ssmClient as unknown as AwsSsmClientLike, '/prod');
const cached = new CachedSecretsAdapter(ssm, Duration.ofMinutes(5));

// First call: fetches from SSM
const a = await cached.get('API_KEY');
// Second call within 5 min: returns in-memory cached value (no SSM round-trip)
const b = await cached.get('API_KEY');

// Cache is invalidated on write / delete / rotate
await cached.set('API_KEY', 'new-tok');
```

### 4. Fallback chain (migration / multi-region)

```typescript
import { FallbackSecretsAdapter, EnvSecretsAdapter, AwsSsmSecretsAdapter } from '@acme/secrets';

const secrets = new FallbackSecretsAdapter([
  new AwsSsmSecretsAdapter(ssmClient as unknown as AwsSsmClientLike, '/prod'),
  new EnvSecretsAdapter(),   // local override when SSM key is absent
]);

// get() tries SSM first, falls through to env if not found
const val = await secrets.get('FEATURE_FLAG');

// set() / delete() propagate to ALL adapters to keep them in sync
await secrets.set('FEATURE_FLAG', 'true');
```

---

## NestJS Integration

```typescript
import { Module }          from '@nestjs/common';
import { SSMClient }       from '@aws-sdk/client-ssm';
import {
  AwsSsmSecretsAdapter,
  CachedSecretsAdapter,
  FallbackSecretsAdapter,
  EnvSecretsAdapter,
} from '@acme/secrets';
import type { AwsSsmClientLike, SecretsPort } from '@acme/secrets';
import { Duration } from '@acme/kernel';

@Module({
  providers: [
    {
      provide:    'SECRETS',
      useFactory: (): SecretsPort => {
        const ssm = new SSMClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
        const ssmAdapter    = new AwsSsmSecretsAdapter(ssm as unknown as AwsSsmClientLike, '/myapp');
        const fallback      = new FallbackSecretsAdapter([ssmAdapter, new EnvSecretsAdapter()]);
        return new CachedSecretsAdapter(fallback, Duration.ofMinutes(5));
      },
    },
  ],
  exports: ['SECRETS'],
})
export class SecretsModule {}
```

---

## API Reference

### `SecretsPort`

```typescript
interface SecretsPort {
  get(key: string): Promise<Option<string>>;    // Option.some on hit, Option.none on miss
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  rotate(key: string): Promise<void>;           // throws SecretsRotationNotSupportedError when unsupported
}
```

### `EnvSecretsAdapter`

| Method | Behaviour |
|--------|-----------|
| `get(key)` | `Option.fromNullable(process.env[key])` |
| `set(key, value)` | `process.env[key] = value` |
| `delete(key)` | `delete process.env[key]` |
| `rotate(key)` | Throws `SecretsRotationNotSupportedError` |

### `CachedSecretsAdapter`

```typescript
new CachedSecretsAdapter(inner: SecretsPort, ttl: Duration)
```

- Cache hit: returns stored value without calling `inner`
- Cache miss: delegates, then stores result for `ttl` milliseconds
- `set` / `delete` / `rotate`: delegates AND evicts the affected key

### `FallbackSecretsAdapter`

```typescript
new FallbackSecretsAdapter(adapters: readonly SecretsPort[])
```

- **`get`**: returns first `Option.some`; `Option.none` when all miss
- **`set` / `delete` / `rotate`**: propagates to ALL adapters in order

### `AwsSsmSecretsAdapter`

```typescript
new AwsSsmSecretsAdapter(client: AwsSsmClientLike, prefix?: string)
```

| Method | SSM operation |
|--------|---------------|
| `get(key)` | `GetParameter` with `WithDecryption: true`; `ParameterNotFound` → `Option.none` |
| `set(key, value)` | `PutParameter` with `Type: 'SecureString'`, `Overwrite: true` |
| `delete(key)` | `DeleteParameter` |
| `rotate(key)` | Throws `SecretsRotationNotSupportedError` |

### `AwsSsmClientLike` (structural interface)

```typescript
interface AwsSsmClientLike {
  getParameter(params: AwsSsmGetParameterParams): Promise<AwsSsmGetParameterResult>;
  putParameter(params: AwsSsmPutParameterParams): Promise<unknown>;
  deleteParameter(params: AwsSsmDeleteParameterParams): Promise<unknown>;
}
```

### `SecretsRotationNotSupportedError`

```typescript
class SecretsRotationNotSupportedError extends Error {
  constructor(adapterName: string)
  // err.name === 'SecretsRotationNotSupportedError'
}
```

---

## Package Structure

```
packages/secrets/
├── src/
│   ├── SecretsPort.ts            ← Core interface
│   ├── SecretsErrors.ts          ← SecretsRotationNotSupportedError
│   ├── AwsSsmClientLike.ts       ← Structural interface (no AWS SDK import)
│   ├── EnvSecretsAdapter.ts      ← process.env adapter
│   ├── CachedSecretsAdapter.ts   ← TTL cache decorator
│   ├── FallbackSecretsAdapter.ts ← Ordered fallback chain
│   ├── AwsSsmSecretsAdapter.ts   ← AWS SSM Parameter Store
│   ├── index.ts                  ← Public exports
│   └── secrets.test.ts           ← 19 unit tests
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Testing

```bash
pnpm --filter @acme/secrets test
```

All 19 tests are pure unit tests using `vi.fn()` mocks — no AWS credentials or network required.

| Suite | Tests |
|-------|-------|
| EnvSecretsAdapter | 5 |
| CachedSecretsAdapter | 5 |
| FallbackSecretsAdapter | 5 |
| AwsSsmSecretsAdapter | 4 |
| **Total** | **19** |

---

## Design Notes

- **`Option<string>`**: consistent with `@acme/kernel` semantics — callers must explicitly handle the missing case
- **Structural `AwsSsmClientLike`**: decouples the library from `@aws-sdk/client-ssm`; same pattern as `RedisClientLike` in `@acme/cache-redis`
- **`CachedSecretsAdapter` is a decorator**: compose with any adapter — no inheritance, no tight coupling
- **`FallbackSecretsAdapter` writes to ALL**: on `set`/`delete`, all adapters stay in sync to prevent stale reads on the next `get` traversal

## Related Packages

| Package | Purpose |
|---------|---------|
| `@acme/kernel` | `Option<T>`, `Duration` |
| `@acme/cache-redis` | Redis cache (complementary caching layer) |
| `@acme/security` | AuthN/AuthZ primitives |
