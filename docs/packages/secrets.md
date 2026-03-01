# @acme/secrets

Secrets management following the Port/Adapter pattern. Domain code depends only on `SecretsPort`; the adapter (Env, SSM, Vault, etc.) is injected at startup.

**Install:** `pnpm add @acme/secrets @acme/kernel`

---

## Adapters Overview

| Adapter                  | Use Case                                       |
| ------------------------ | ---------------------------------------------- |
| `EnvSecretsAdapter`      | Development — reads from environment variables |
| `AwsSsmSecretsAdapter`   | AWS Parameter Store (SSM)                      |
| `VaultSecretsAdapter`    | HashiCorp Vault                                |
| `CachedSecretsAdapter`   | Wraps any adapter with an in-memory TTL cache  |
| `FallbackSecretsAdapter` | Tries adapters in order; returns first success |

---

## Basic Usage

```typescript
import {
  SecretsPort,
  EnvSecretsAdapter,
  AwsSsmSecretsAdapter,
  CachedSecretsAdapter,
  FallbackSecretsAdapter,
} from '@acme/secrets';

// Development
const devSecrets: SecretsPort = new EnvSecretsAdapter();

// Production — AWS SSM with 5-minute in-memory cache
const ssmSecrets: SecretsPort = new CachedSecretsAdapter(
  new AwsSsmSecretsAdapter(ssmClient, { prefix: '/myapp/' }),
  { ttlSeconds: 300 },
);

// Fallback chain — try SSM first, fall back to env
const secrets: SecretsPort = new FallbackSecretsAdapter([ssmSecrets, devSecrets]);

// Retrieve values
const jwtSecret = await secrets.get('jwt-secret');
const dbPassword = await secrets.get('db-password');
```

---

## Using the Port in Domain / Application Code

The domain and application layers never import adapters — they depend on `SecretsPort`:

```typescript
// application/usecases/bootstrap/LoadSecretsUseCase.ts
import type { SecretsPort } from '@acme/secrets';
import { ConfigServer } from '@acme/config';

export class LoadSecretsUseCase {
  constructor(
    private readonly secrets: SecretsPort,
    private readonly config: ConfigServer,
  ) {}

  async execute(): Promise<void> {
    const jwtSecret = await this.secrets.get('jwt-secret');
    const dbPassword = await this.secrets.get('db-password');

    this.config.set('jwt.secret', jwtSecret);
    this.config.set('db.password', dbPassword);
  }
}
```

---

## Custom Adapter

Implement `SecretsPort` to integrate with any secret store:

```typescript
import type { SecretsPort } from '@acme/secrets';

export class AzureKeyVaultAdapter implements SecretsPort {
  constructor(private readonly client: SecretClient) {}

  async get(key: string): Promise<string> {
    const secret = await this.client.getSecret(key);
    if (!secret.value) throw new Error(`Secret not found: ${key}`);
    return secret.value;
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.setSecret(key, value);
  }
}
```

---

## `CachedSecretsAdapter` Configuration

```typescript
const cachedSecrets = new CachedSecretsAdapter(innerAdapter, {
  ttlSeconds: 300, // cache each secret for 5 minutes
  maxEntries: 100, // cap in-memory entries
  onMiss: (key) => logger.debug('Secret cache miss', { key }),
});
```

---

## Summary

| Export                   | Purpose                                            |
| ------------------------ | -------------------------------------------------- |
| `SecretsPort`            | Interface — the only thing domain/app code imports |
| `EnvSecretsAdapter`      | Reads secrets from environment variables           |
| `AwsSsmSecretsAdapter`   | AWS Systems Manager Parameter Store                |
| `VaultSecretsAdapter`    | HashiCorp Vault                                    |
| `CachedSecretsAdapter`   | TTL cache wrapper for any adapter                  |
| `FallbackSecretsAdapter` | Try adapters in order until one succeeds           |
