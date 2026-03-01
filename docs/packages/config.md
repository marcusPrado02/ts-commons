# @acme/config

12-Factor (Factor III) configuration: environment-aware, hot-reloadable, schema-validated.

**Install:** `pnpm add @acme/config @acme/kernel`

---

## `ConfigServer` — Centralised Configuration

```typescript
import { ConfigServer } from '@acme/config';

const config = new ConfigServer();

// Set values (typically from env vars at startup)
config.set('db.host', process.env.DB_HOST ?? 'localhost');
config.set('db.port', Number(process.env.DB_PORT ?? 5432));
config.set('db.name', process.env.DB_NAME ?? 'orders');
config.set('http.port', Number(process.env.PORT ?? 3000));
config.set('jwt.secret', process.env.JWT_SECRET ?? '');

// Register environment profiles
config.registerProfile('production', {
  'db.host': process.env.PROD_DB_HOST!,
  'log.level': 'warn',
});
config.registerProfile('staging', {
  'db.host': process.env.STAGING_DB_HOST!,
  'log.level': 'info',
});

// Read (profile wins over base)
const dbHost = config.get<string>('db.host', process.env.NODE_ENV);
const port = config.get<number>('http.port') ?? 3000;

// React to changes (e.g. remote config refresh)
config.onRefresh((key, value) => {
  console.log(`Config updated: ${key} = ${String(value)}`);
});

// Bulk read
const all = config.getAll(); // Record<string, unknown>
```

---

## `ProfileManager` — Environment Profiles

Manages named configuration profiles with inheritance from `default`.

```typescript
import { ProfileManager } from '@acme/config';

const pm = new ProfileManager();
pm.register('default', { timeout: 5000, retries: 3, logLevel: 'info' });
pm.register('production', { timeout: 3000, retries: 5, logLevel: 'warn' });
pm.register('staging', { timeout: 4000, retries: 4 });

pm.activate(process.env.NODE_ENV ?? 'default');

const timeout = pm.get<number>('timeout'); // merged: default + active profile
const logLevel = pm.get<string>('logLevel');
const all = pm.getAll(); // full merged config object
```

---

## `HotReloadConfigLoader` — Live Configuration Updates

Polls a remote source and applies changes at runtime — no restart needed.

```typescript
import { HotReloadConfigLoader } from '@acme/config';

const loader = new HotReloadConfigLoader(config, {
  intervalMs: 30_000, // poll every 30 seconds
  source: remoteConfigSource, // any object implementing ConfigSource interface
});

await loader.start();
// When the source returns new values, config.onRefresh callbacks fire automatically

// Stop on shutdown
shutdown.register('config-loader', () => loader.stop());
```

---

## `ZodConfigSchema` — Validation at Startup

Validates the full config object against a Zod schema. Throws a descriptive error if any value is missing or wrong — fail fast at boot, not at runtime.

```typescript
import { ZodConfigSchema } from '@acme/config';
import { z } from 'zod';

const schema = new ZodConfigSchema(
  z.object({
    'db.host': z.string().min(1),
    'db.port': z.number().int().positive(),
    'jwt.secret': z.string().min(32),
    'http.port': z.number().int().min(1024).max(65535),
    'log.level': z.enum(['debug', 'info', 'warn', 'error']),
  }),
);

// Throws ZodConfigValidationError with full error list if invalid
schema.validate(config.getAll());
```

---

## Typical Bootstrap Pattern

```typescript
// src/infrastructure/config/bootstrap.ts
import { ConfigServer, ZodConfigSchema } from '@acme/config';
import { z } from 'zod';

export function buildConfig(): ConfigServer {
  const config = new ConfigServer();

  config.set('http.port', Number(process.env.PORT ?? 3000));
  config.set('db.url', process.env.DATABASE_URL ?? '');
  config.set('kafka.brokers', process.env.KAFKA_BROKERS ?? 'kafka:9092');
  config.set('redis.host', process.env.REDIS_HOST ?? 'redis');
  config.set('jwt.secret', process.env.JWT_SECRET ?? '');
  config.set('log.level', process.env.LOG_LEVEL ?? 'info');

  const schema = new ZodConfigSchema(
    z.object({
      'http.port': z.number().min(1),
      'db.url': z.string().min(1),
      'kafka.brokers': z.string().min(1),
      'redis.host': z.string().min(1),
      'jwt.secret': z.string().min(32),
    }),
  );
  schema.validate(config.getAll()); // fail fast

  return config;
}
```

---

## Summary

| Export                  | Purpose                                             |
| ----------------------- | --------------------------------------------------- |
| `ConfigServer`          | Central key-value config store with profile support |
| `ProfileManager`        | Named profiles with inheritance from default        |
| `HotReloadConfigLoader` | Live config refresh from remote source              |
| `ZodConfigSchema`       | Schema validation at startup                        |
