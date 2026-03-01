# @acme/kernel

The foundational package with zero runtime dependencies. Provides all DDD primitives for building domain models.

**Install:** `pnpm add @acme/kernel`

---

## `Result<T, E>` — Railway-Oriented Programming

Replaces thrown exceptions in domain code. Every operation that can fail returns `Result` instead of throwing.

```typescript
import { Result } from '@acme/kernel';

// Creating results
const ok = Result.ok<Order, DomainError>(order);
const err = Result.err<Order, DomainError>(new InsufficientStockError());

// Consuming
const result = placeOrder(command);

result.match({
  ok: (order) => console.log('Created:', order.id),
  err: (error) => console.error('Failed:', error.message),
});

// Monadic pipeline
const finalResult = validateStock(items)
  .flatMap((validItems) => calculateTotal(validItems))
  .map((total) => new Order(id, total, validItems));

// Collect multiple results
const allResults = Result.all([result1, result2, result3]);
// → Ok<T[]> if all ok, otherwise the first Err

// Partition a batch
const { oks, errs } = Result.partition(orderResults);
```

---

## `ValueObject` — Immutable Domain Values

Compared by value, not reference. Invariants are enforced in static factory methods.

```typescript
import { ValueObject, Result } from '@acme/kernel';

interface MoneyProps {
  amount: number;
  currency: string;
}

export class Money extends ValueObject<MoneyProps> {
  static create(amount: number, currency: string): Result<Money, DomainError> {
    if (amount < 0) return Result.err(new InvariantViolationError('Amount cannot be negative'));
    if (!['BRL', 'USD', 'EUR'].includes(currency))
      return Result.err(new InvariantViolationError('Invalid currency'));
    return Result.ok(new Money({ amount, currency }));
  }

  get amount(): number {
    return this.props.amount;
  }
  get currency(): string {
    return this.props.currency;
  }

  add(other: Money): Result<Money, DomainError> {
    if (this.currency !== other.currency)
      return Result.err(new InvariantViolationError('Currency mismatch'));
    return Money.create(this.amount + other.amount, this.currency);
  }

  // equals() is inherited — structural comparison of props
}

// Usage
const price = Money.create(100, 'BRL').unwrap();
const tax = Money.create(10, 'BRL').unwrap();
const total = price.add(tax).unwrap(); // Money(110, BRL)
```

---

## `Entity` and `AggregateRoot`

Entities have identity (ID). `AggregateRoot` is a specialised entity that:

- Enforces consistency invariants
- Records domain events for later publication
- Controls the transaction boundary

```typescript
import { AggregateRoot, DomainEvent, Result } from '@acme/kernel';

// 1. Domain Event
export class OrderPlacedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly total: Money,
  ) {
    super({ aggregateId: orderId });
  }
}

// 2. Aggregate Root
export class Order extends AggregateRoot<OrderId> {
  private _status: OrderStatus = 'PENDING';
  private _items: OrderItem[] = [];
  private _total: Money;

  private constructor(id: OrderId, total: Money) {
    super(id);
    this._total = total;
  }

  static place(id: OrderId, items: OrderItem[]): Result<Order, DomainError> {
    if (items.length === 0) return Result.err(new InvariantViolationError('Order must have items'));

    const totalResult = items
      .map((i) => i.price)
      .reduce((acc, p) => acc.flatMap((a) => a.add(p)), Money.create(0, 'BRL'));

    if (totalResult.isErr()) return Result.err(totalResult.unwrapErr());

    const order = new Order(id, totalResult.unwrap());
    order._items = items;
    // Record event — published AFTER persistence
    order.addDomainEvent(new OrderPlacedEvent(id.value, order._total));
    return Result.ok(order);
  }

  get status() {
    return this._status;
  }
  get total() {
    return this._total;
  }
  get items() {
    return this._items as readonly OrderItem[];
  }
}
```

After saving the aggregate, pull and publish events:

```typescript
const order = orderResult.unwrap();
await repo.save(order);
for (const event of order.pullDomainEvents()) {
  await publisher.publish(event);
}
```

---

## `UUID` and `ULID`

```typescript
import { UUID, ULID } from '@acme/kernel';

const uuid = UUID.generate(); // "550e8400-e29b-41d4-a716-446655440000"
UUID.from('550e8400-...'); // parsed / validated

const ulid = ULID.generate(); // "01ARZ3NDEKTSV4RRFFQ69G5FAV"
// ULID: lexicographically sortable, good for primary keys
```

---

## `CorrelationId` and `TenantContext`

```typescript
import { CorrelationId, TenantId, TenantContext } from '@acme/kernel';

const correlationId = CorrelationId.generate();

// Multi-tenancy via AsyncLocalStorage — propagates automatically
TenantContext.run(TenantId.from('tenant-abc'), async () => {
  // TenantContext.current() returns TenantId('tenant-abc') anywhere in this call stack
  await placeOrderUseCase.execute(input);
});
```

---

## `DomainError` Hierarchy

```typescript
import {
  NotFoundError,
  ConflictError,
  InvariantViolationError,
  UnauthorizedError,
} from '@acme/kernel';

throw new NotFoundError('Order', orderId);
// → "Order with id 'xxx' not found"

throw new ConflictError('Order', 'already cancelled');
// → "Conflict on Order: already cancelled"

throw new InvariantViolationError('Price must be positive');
```

---

## `Clock` — Time Abstraction

Makes time-dependent code testable without monkey-patching `Date`.

```typescript
import { SystemClock, Clock } from '@acme/kernel';

class OrderExpirationService {
  constructor(private readonly clock: Clock) {}

  isExpired(order: Order): boolean {
    const now = this.clock.now();
    const deadline = new Date(order.createdAt);
    deadline.setDate(deadline.getDate() + 7);
    return now > deadline;
  }
}

// Production
const service = new OrderExpirationService(new SystemClock());

// Tests — use FakeClock from @acme/testing
const fakeClock = new FakeClock(new Date('2026-01-01'));
const service = new OrderExpirationService(fakeClock);
```

---

## Summary

| Export                                                        | Purpose                               |
| ------------------------------------------------------------- | ------------------------------------- |
| `Result<T, E>`                                                | Railway-oriented error handling       |
| `ValueObject<P>`                                              | Immutable domain values               |
| `Entity<ID>`                                                  | Identity-bearing domain objects       |
| `AggregateRoot<ID>`                                           | Consistency boundary + event recorder |
| `DomainEvent`                                                 | Base class for domain events          |
| `UUID` / `ULID`                                               | Identity generation                   |
| `CorrelationId`                                               | Request tracing                       |
| `TenantId` / `TenantContext`                                  | Multi-tenancy via AsyncLocalStorage   |
| `Clock` / `SystemClock`                                       | Testable time abstraction             |
| `NotFoundError` / `ConflictError` / `InvariantViolationError` | Typed domain errors                   |
