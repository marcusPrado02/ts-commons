# Guide: Testing Strategy

This guide describes the testing approach for microservices built with ts-commons, following the Test Pyramid.

---

## Test Pyramid

```
              ┌─────────┐
              │   E2E   │  Few — full service + real infra
              ├─────────┤
              │Contract │  Pact / AsyncAPI contract tests
              ├─────────┤
           ┌──┤Integration├──┐  Adapters tested against real DB/broker
           │  └───────────┘  │
    ┌──────┴──────────────────┴──────┐
    │           Unit Tests           │  Most — fast, no I/O
    └────────────────────────────────┘
```

---

## Unit Tests — Domain and Application

Unit tests cover `@acme/kernel` domain models and `@acme/application` use cases. They use in-memory fakes from `@acme/testing` — no database, no network.

### Testing a Value Object

```typescript
import { describe, test, expect } from 'vitest';
import '@acme/testing/matchers';
import { Money } from '../domain/Money.js';

describe('Money', () => {
  test('create: rejects negative amount', () => {
    const result = Money.create(-1, 'BRL');
    expect(result).toBeErr();
    expect(result).toBeErrWithMessage('non-negative');
  });

  test('add: sums amounts with same currency', () => {
    const a = Money.create(100, 'BRL').unwrap();
    const b = Money.create(50, 'BRL').unwrap();

    const result = a.add(b);
    expect(result).toBeOk();
    expect(result).toBeOkWith(expect.objectContaining({ amount: 150 }));
  });

  test('add: fails on currency mismatch', () => {
    const brl = Money.create(100, 'BRL').unwrap();
    const usd = Money.create(50, 'USD').unwrap();

    expect(brl.add(usd)).toBeErr();
  });
});
```

### Testing an Aggregate

```typescript
import { describe, test, expect } from 'vitest';
import '@acme/testing/matchers';
import { Order } from '../domain/Order.js';

describe('Order', () => {
  test('place: creates order with OrderPlacedEvent', () => {
    const result = Order.place('customer-1', [{ productId: 'p-1', qty: 2, price: 50 }]);

    expect(result).toBeOk();

    const order = result.unwrap();
    expect(order.status).toBe('PENDING');
    expect(order.total.amount).toBe(100);

    const events = order.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.constructor.name).toBe('OrderPlacedEvent');
  });

  test('place: rejects empty items', () => {
    const result = Order.place('customer-1', []);
    expect(result).toBeErr();
    expect(result).toBeErrWithMessage('at least one item');
  });
});
```

### Testing a Use Case

```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import '@acme/testing/matchers';
import { InMemoryOutboxStore, InMemoryUnitOfWork } from '@acme/testing';
import { PlaceOrderUseCase } from '../application/usecases/PlaceOrderUseCase.js';
import { InMemoryOrderRepository } from './helpers/InMemoryOrderRepository.js';

describe('PlaceOrderUseCase', () => {
  let useCase: PlaceOrderUseCase;
  let orderRepo: InMemoryOrderRepository;
  let outboxStore: InMemoryOutboxStore;

  beforeEach(() => {
    orderRepo = new InMemoryOrderRepository();
    outboxStore = new InMemoryOutboxStore();
    useCase = new PlaceOrderUseCase(new InMemoryUnitOfWork(), orderRepo, outboxStore);
  });

  test('saves order and records outbox event', async () => {
    const result = await useCase.execute({
      customerId: 'customer-1',
      items: [{ productId: 'p-1', qty: 1, price: 100 }],
    });

    expect(result).toBeOk();

    const orders = await orderRepo.findAll();
    expect(orders).toHaveLength(1);

    const events = outboxStore.getPending();
    expect(events).toHaveLength(1);
    expect(events[0]!.eventType).toBe('OrderPlacedEvent');
  });

  test('returns Err for empty items', async () => {
    const result = await useCase.execute({
      customerId: 'customer-1',
      items: [],
    });

    expect(result).toBeErr();
    expect(await orderRepo.findAll()).toHaveLength(0);
    expect(outboxStore.getPending()).toHaveLength(0);
  });
});
```

---

## Integration Tests — Infrastructure Adapters

Integration tests verify that adapters work correctly against real infrastructure. Run these in CI with Docker or Testcontainers.

```typescript
// test/integration/PrismaOrderRepository.spec.ts
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaOrderRepository } from '../../src/infrastructure/persistence/PrismaOrderRepository.js';
import { Order } from '../../src/domain/Order.js';

describe('PrismaOrderRepository (integration)', () => {
  let prisma: PrismaClient;
  let repo: PrismaOrderRepository;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    repo = new PrismaOrderRepository(prisma);
  });

  afterAll(() => prisma.$disconnect());

  beforeEach(() => prisma.order.deleteMany());

  test('saves and retrieves an order', async () => {
    const order = Order.place('customer-1', [{ productId: 'p-1', qty: 1, price: 100 }]).unwrap();

    await repo.save(order);

    const retrieved = await repo.findById(order.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(order.id);
    expect(retrieved!.total.amount).toBe(100);
  });

  test('findByCustomerId returns only matching orders', async () => {
    const o1 = Order.place('customer-A', [{ productId: 'p-1', qty: 1, price: 50 }]).unwrap();
    const o2 = Order.place('customer-B', [{ productId: 'p-2', qty: 1, price: 75 }]).unwrap();

    await repo.save(o1);
    await repo.save(o2);

    const orders = await repo.findByCustomerId('customer-A');
    expect(orders).toHaveLength(1);
    expect(orders[0]!.customerId).toBe('customer-A');
  });
});
```

---

## FakeClock in Tests

```typescript
import { FakeClock, Duration } from '@acme/testing';
import { describe, test, expect } from 'vitest';

describe('OrderExpirationService', () => {
  test('expires orders older than 7 days', async () => {
    const clock = new FakeClock(new Date('2026-01-01'));
    const service = new OrderExpirationService(clock, orderRepo);

    await orderRepo.save(Order.place('c-1', [item]).unwrap());

    // 6 days later — not expired
    clock.advance(Duration.ofDays(6));
    expect(await service.findExpired()).toHaveLength(0);

    // 8 days later — expired
    clock.advance(Duration.ofDays(2));
    expect(await service.findExpired()).toHaveLength(1);
  });
});
```

---

## Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['@acme/testing/matchers'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: ['src/**/*.spec.ts', 'src/**/index.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
});
```

---

## Architecture Tests

`@acme/architecture-tests` enforces layer rules at test time as fitness functions:

```typescript
// test/architecture.spec.ts
import { describe, test } from 'vitest';
import { ArchitectureTests } from '@acme/architecture-tests';

const arch = new ArchitectureTests({ root: './src' });

describe('Architecture', () => {
  test('domain layer has no infrastructure imports', async () => {
    await arch.assertLayerHasNoImportsFrom('domain', ['**/infrastructure/**', '**/transport/**']);
  });

  test('application layer has no infrastructure imports', async () => {
    await arch.assertLayerHasNoImportsFrom('application', [
      '**/infrastructure/**',
      '**/transport/**',
    ]);
  });

  test('all domain exports go through barrel', async () => {
    await arch.assertNoIndexBypassImports('domain');
  });
});
```

---

## Test File Conventions

| File pattern                    | Type                           |
| ------------------------------- | ------------------------------ |
| `src/**/*.spec.ts`              | Unit test (co-located)         |
| `test/integration/**/*.spec.ts` | Integration test               |
| `test/e2e/**/*.spec.ts`         | End-to-end test                |
| `test/architecture.spec.ts`     | Architecture fitness functions |

---

## Summary

| Test type    | Tool                       | Fakes used                                                                         |
| ------------ | -------------------------- | ---------------------------------------------------------------------------------- |
| Unit         | Vitest                     | `InMemoryRepository`, `InMemoryOutboxStore`, `FakeClock`, `InMemoryEventPublisher` |
| Integration  | Vitest                     | Real DB/broker (Testcontainers or local Docker)                                    |
| Contract     | Pact / AsyncAPI            | —                                                                                  |
| E2E          | Vitest + Supertest         | Running service instance                                                           |
| Architecture | `@acme/architecture-tests` | —                                                                                  |
