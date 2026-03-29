# @marcusprado02/testing

**Testing Utilities** - Test fakes, builders, fixtures, custom Vitest matchers, performance helpers, Testcontainers integration, and bundle analysis tools.

## Installation

```
pnpm add -D @marcusprado02/testing
```

## Key Exports

| Export                             | Kind             | Description                             |
| ---------------------------------- | ---------------- | --------------------------------------- |
| `FakeClock`                        | class            | Deterministic time control for tests    |
| `InMemoryIdempotencyStore`         | class            | In-memory idempotency store test double |
| `InMemoryOutboxStore`              | class            | In-memory outbox store test double      |
| `Builder`                          | class            | Generic test builder pattern            |
| `EventEnvelopeFixture`             | class            | Factory for test event envelopes        |
| `registerAcmeMatchers`             | function         | Registers custom Vitest matchers        |
| `PerformanceTimer`, `measureAsync` | class / function | Benchmark helpers                       |
| `ContainerTestHarness`             | class            | Testcontainers lifecycle manager        |
| `FakeTestContainer`                | class            | In-process container substitute         |
| `Seeder`                           | type             | Interface for database seeders          |
| `BundleSizeChecker`                | class            | Enforces bundle size budgets            |
| `ExportAuditor`                    | class            | Audits public package exports           |
| `DependencyAuditor`                | class            | Audits dependency graph                 |
| `TreeShakeChecker`                 | class            | Verifies tree-shaking of exports        |
| `CodeSplitAnalyzer`                | class            | Analyzes code-split chunk boundaries    |

## Usage

### Controlling time with FakeClock

```typescript
import { FakeClock } from '@marcusprado02/testing';
import { describe, it, expect } from 'vitest';

describe('subscription expiry', () => {
  it('expires after 30 days', async () => {
    const clock = new FakeClock(new Date('2026-01-01T00:00:00Z'));
    const subscription = new Subscription({ clock });

    clock.advance({ days: 31 });

    expect(subscription.isExpired()).toBe(true);
  });
});
```

### Building test objects with Builder and EventEnvelopeFixture

```typescript
import { Builder, EventEnvelopeFixture } from '@marcusprado02/testing';

interface OrderPayload {
  orderId: string;
  customerId: string;
  total: number;
}

const orderBuilder = new Builder<OrderPayload>({
  orderId: 'order-1',
  customerId: 'cust-42',
  total: 99.99,
});

const order = orderBuilder.with({ total: 0 }).build();

const envelope = EventEnvelopeFixture.create('order.created', order);
```

### Integration tests with ContainerTestHarness

```typescript
import { ContainerTestHarness, FakeTestContainer, Seeder } from '@marcusprado02/testing';
import { describe, it, beforeAll, afterAll } from 'vitest';

const harness = new ContainerTestHarness([new FakeTestContainer('postgres')]);

const seeder: Seeder = {
  async seed(connection) {
    await connection.query("INSERT INTO users VALUES (1, 'Alice')");
  },
};

describe('UserRepository', () => {
  beforeAll(() => harness.start([seeder]));
  afterAll(() => harness.stop());

  it('finds a user by id', async () => {
    const repo = new UserRepository(harness.connection('postgres'));
    expect(await repo.findById(1)).toMatchObject({ name: 'Alice' });
  });
});
```

## Dependencies

- `@marcusprado02/kernel` - domain primitives and identity types
- `@marcusprado02/application` - application-layer interfaces
- `@marcusprado02/messaging` - event envelope types
- `@marcusprado02/outbox` - outbox store interfaces
