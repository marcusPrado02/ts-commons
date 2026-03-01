# @acme/testing

Test utilities: typed builders, fake implementations, Vitest custom matchers, and in-memory stores. Keeps tests fast, readable, and deterministic.

**Install (dev):** `pnpm add -D @acme/testing`

---

## `Builder<T>` — Test Data Builder

Reduces repetitive setup code and makes test intent clear.

```typescript
import { Builder } from '@acme/testing';

class OrderBuilder extends Builder<OrderProps> {
  withId(id: string) {
    return this.set('id', id);
  }
  withStatus(s: OrderStatus) {
    return this.set('status', s);
  }
  withItems(items: OrderItem[]) {
    return this.set('items', items);
  }
  withTotal(total: Money) {
    return this.set('total', total);
  }

  build(): Order {
    return Order.reconstitute({
      id: this.props.id ?? UUID.generate(),
      status: this.props.status ?? 'PENDING',
      items: this.props.items ?? [defaultItem()],
      total: this.props.total ?? Money.create(100, 'BRL').unwrap(),
    });
  }
}

// In tests
const order = new OrderBuilder().withStatus('CONFIRMED').withItems([item1, item2]).build();

// Minimal — uses all defaults
const minimalOrder = new OrderBuilder().build();
```

---

## `FakeClock` — Deterministic Time

Lets you control `Date.now()` without monkey-patching. Used wherever code depends on `Clock` from `@acme/kernel`.

```typescript
import { FakeClock, Duration } from '@acme/testing';

const clock = new FakeClock(new Date('2026-01-01T12:00:00Z'));

const service = new OrderExpirationService(clock);

// nothing expired yet
expect(service.findExpired()).toHaveLength(0);

// advance time by 8 days
clock.advance(Duration.ofDays(8));

// now orders older than 7 days should be expired
expect(service.findExpired()).toHaveLength(1);

// set to an absolute time
clock.setTime(new Date('2026-06-15T09:00:00Z'));
```

---

## `vitestMatchers` — Custom Matchers for `Result`

Register once in `vitest.config.ts` and use in every test file.

### Setup

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['@acme/testing/matchers'],
  },
});
```

### Usage

```typescript
import { describe, test, expect } from 'vitest';

describe('PlaceOrderUseCase', () => {
  test('returns Ok with orderId on success', async () => {
    const result = await placeOrderUseCase.execute(validInput);

    expect(result).toBeOk();
    expect(result).toBeOkWith({ orderId: expect.any(String) });
  });

  test('returns Err when items list is empty', async () => {
    const result = await placeOrderUseCase.execute({ ...validInput, items: [] });

    expect(result).toBeErr();
    expect(result).toBeErrWith(InvariantViolationError);
  });
});
```

### Matcher Reference

| Matcher                   | Assertion                                             |
| ------------------------- | ----------------------------------------------------- |
| `toBeOk()`                | `result.isOk() === true`                              |
| `toBeErr()`               | `result.isErr() === true`                             |
| `toBeOkWith(value)`       | `isOk()` and payload matches `value` (deep equal)     |
| `toBeErrWith(ErrorClass)` | `isErr()` and error is an instance of `ErrorClass`    |
| `toBeErrWithMessage(msg)` | `isErr()` and `error.message` matches string or regex |

---

## `InMemoryOutboxStore` — Outbox Fake

Replaces `PrismaOutboxStore` or `MongoOutboxStore` in unit tests.

```typescript
import { InMemoryOutboxStore } from '@acme/testing';

const outboxStore = new InMemoryOutboxStore();
const useCase = new PlaceOrderUseCase(uow, orderRepo, outboxStore);

await useCase.execute(validInput);

const events = outboxStore.getPending();
expect(events).toHaveLength(1);
expect(events[0]!.eventType).toBe('OrderPlacedEvent');

// Clear between tests
outboxStore.clear();
```

---

## `InMemoryRepository` — Generic Fake Repository

```typescript
import { InMemoryRepository } from '@acme/testing';

class InMemoryOrderRepository extends InMemoryRepository<Order> implements OrderRepository {
  async findByCustomerId(customerId: string): Promise<Order[]> {
    return this.findMany((o) => o.customerId === customerId);
  }

  async findPending(): Promise<Order[]> {
    return this.findMany((o) => o.status === 'PENDING');
  }
}

// In tests
const orderRepo = new InMemoryOrderRepository();
orderRepo.seed([order1, order2]); // pre-populate
```

---

## `InMemoryEventPublisher` — Fake Publisher

```typescript
import { InMemoryEventPublisher } from '@acme/testing';

const publisher = new InMemoryEventPublisher();
const useCase = new PlaceOrderUseCase(repo, publisher);

await useCase.execute(validInput);

const published = publisher.getPublished();
expect(published).toHaveLength(1);
expect(published[0]!.type).toBe('OrderPlacedEvent');
```

---

## Test Structure Recommendation

```typescript
describe('PlaceOrderUseCase', () => {
  let orderRepo: InMemoryOrderRepository;
  let outboxStore: InMemoryOutboxStore;
  let publisher: InMemoryEventPublisher;
  let clock: FakeClock;
  let useCase: PlaceOrderUseCase;

  beforeEach(() => {
    orderRepo = new InMemoryOrderRepository();
    outboxStore = new InMemoryOutboxStore();
    publisher = new InMemoryEventPublisher();
    clock = new FakeClock(new Date('2026-01-01'));
    useCase = new PlaceOrderUseCase(
      new InMemoryUnitOfWork(),
      orderRepo,
      outboxStore,
      publisher,
      clock,
    );
  });

  test('places order and saves to outbox', async () => {
    const result = await useCase.execute(validInput);

    expect(result).toBeOk();
    expect(await orderRepo.findAll()).toHaveLength(1);
    expect(outboxStore.getPending()).toHaveLength(1);
  });
});
```

---

## Summary

| Export                   | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `Builder<T>`             | Fluent test data builder                            |
| `FakeClock`              | Controllable time (implements `Clock`)              |
| `Duration`               | Helper: `Duration.ofDays(n)`, `Duration.ofHours(n)` |
| `vitestMatchers`         | `toBeOk`, `toBeErr`, `toBeOkWith`, `toBeErrWith`    |
| `InMemoryOutboxStore`    | Fake outbox store for unit tests                    |
| `InMemoryRepository<T>`  | Generic in-memory repository base                   |
| `InMemoryEventPublisher` | Fake event publisher                                |
| `InMemoryUnitOfWork`     | Fake UoW that runs callback inline                  |
