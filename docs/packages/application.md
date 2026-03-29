# @marcusprado02/application

Use Cases, CQRS buses, Mediator pipeline, idempotency, and Unit of Work.

**Install:** `pnpm add @marcusprado02/application @marcusprado02/kernel`

---

## `UseCase<TInput, TOutput>` — Base Class

Each business operation is an independent `UseCase`. This keeps domain logic isolated and testable.

```typescript
import { UseCase } from '@marcusprado02/application';
import { Result } from '@marcusprado02/kernel';

export interface PlaceOrderInput {
  customerId: string;
  items: Array<{ productId: string; qty: number; price: number }>;
}

export type PlaceOrderOutput = { orderId: string };

export class PlaceOrderUseCase implements UseCase<PlaceOrderInput, PlaceOrderOutput> {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly eventPublisher: EventPublisherPort,
  ) {}

  async execute(input: PlaceOrderInput): Promise<Result<PlaceOrderOutput, DomainError>> {
    const id = OrderId.from(UUID.generate());
    const items = input.items.map(mapToOrderItem);

    const orderResult = Order.place(id, items);
    if (orderResult.isErr()) return Result.err(orderResult.unwrapErr());

    const order = orderResult.unwrap();
    await this.orderRepo.save(order);

    for (const event of order.pullDomainEvents()) {
      await this.eventPublisher.publish(event);
    }

    return Result.ok({ orderId: id.value });
  }
}
```

---

## `CommandBus` and `QueryBus`

Decouples the caller from the handler. Commands mutate state; queries read state.

```typescript
import { CommandBus, QueryBus, Command, Query } from '@marcusprado02/application';

// Commands (writes)
export class PlaceOrderCommand extends Command {
  constructor(
    public readonly customerId: string,
    public readonly items: OrderItemInput[],
  ) {
    super();
  }
}

const commandBus = new CommandBus();
commandBus.register(PlaceOrderCommand, new PlaceOrderUseCase(repo, publisher));

const result = await commandBus.dispatch(new PlaceOrderCommand('customer-1', items));

// Queries (reads)
export class GetOrderQuery extends Query<OrderDto> {
  constructor(public readonly orderId: string) {
    super();
  }
}

const queryBus = new QueryBus();
queryBus.register(GetOrderQuery, new GetOrderQueryHandler(readModel));

const order = await queryBus.dispatch(new GetOrderQuery('order-123'));
```

---

## `Mediator` with Behaviors (Pipeline)

Mediator adds cross-cutting concerns (logging, validation, caching) as decorators around handlers — without modifying the handlers themselves.

```typescript
import {
  Mediator,
  LoggingBehavior,
  ValidationBehavior,
  CachingBehavior,
} from '@marcusprado02/application';

const mediator = new Mediator([
  new LoggingBehavior(logger),
  new ValidationBehavior(validator),
  new CachingBehavior(cache, { ttlSeconds: 60 }),
]);

// Pipeline: log → validate → cache-check → handler → cache-store → log
const result = await mediator.send(new GetOrderQuery('order-123'));
```

### Built-in Behaviors

| Behavior             | Effect                                                     |
| -------------------- | ---------------------------------------------------------- |
| `LoggingBehavior`    | Logs incoming request and outgoing result with timing      |
| `ValidationBehavior` | Runs validator before the handler                          |
| `CachingBehavior`    | Returns cached result for queries; bypasses handler on hit |
| `RetryBehavior`      | Retries failed handlers N times                            |
| `MetricsBehavior`    | Records execution duration and success/error counters      |

---

## `IdempotentUseCase` — Duplicate Protection

Wraps any use case to make it idempotent. Re-submitting the same `idempotencyKey` returns the cached result without re-executing.

```typescript
import { IdempotentUseCase, InMemoryIdempotencyStore } from '@marcusprado02/application';

// Swap InMemoryIdempotencyStore for RedisIdempotencyStore in production
const store = new InMemoryIdempotencyStore();

const idempotentPlaceOrder = new IdempotentUseCase(new PlaceOrderUseCase(repo, publisher), store);

const result = await idempotentPlaceOrder.execute(input, {
  idempotencyKey: 'order-abc-123',
});
// Second call with same key → returns cached result, no side effects
```

---

## `UnitOfWork` — Transactions

Ensures multiple repository operations run in a single atomic transaction.

```typescript
import { UnitOfWork } from '@marcusprado02/application';

export class PlaceOrderUseCase implements UseCase<PlaceOrderInput, PlaceOrderOutput> {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly orderRepo: OrderRepository,
    private readonly stockRepo: StockRepository,
  ) {}

  async execute(input: PlaceOrderInput) {
    return this.uow.run(async () => {
      const order = Order.place(OrderId.generate(), input.items).unwrap();
      await this.orderRepo.save(order); // ─┐ same
      await this.stockRepo.decrement(order.items); // ─┘ transaction
      return Result.ok({ orderId: order.id.value });
    });
  }
}
```

---

## Summary

| Export                   | Purpose                            |
| ------------------------ | ---------------------------------- |
| `UseCase<I, O>`          | Base interface for all use cases   |
| `Command` / `CommandBus` | Write-side CQRS                    |
| `Query<T>` / `QueryBus`  | Read-side CQRS                     |
| `Mediator`               | Pipeline dispatcher with behaviors |
| `LoggingBehavior`        | Log + timing around every handler  |
| `ValidationBehavior`     | Validate input before handler runs |
| `CachingBehavior`        | Cache query results                |
| `IdempotentUseCase`      | Prevent duplicate executions       |
| `UnitOfWork`             | Transaction coordination           |
