# Quick Start Guide — ts-commons

A TypeScript enterprise monorepo with **66 packages** following Clean Architecture, DDD, Hexagonal Architecture, and CQRS.

---

## Prerequisites

- Node.js 20+
- pnpm 8.15+

## 1. Install dependencies

```bash
pnpm install
```

## 2. Build all packages

```bash
pnpm build
# or, for fine-grained build order:
./scripts/build-all.sh
```

## 3. Run tests

```bash
pnpm test
# or single package:
pnpm --filter @acme/kernel exec vitest run
```

## 4. Lint + format

```bash
pnpm lint          # ESLint (type-checked)
pnpm format        # Prettier
pnpm format --check  # CI mode
```

## 5. Full validation (build + test + lint)

```bash
./scripts/validate-all.sh
# Skip phases:
./scripts/validate-all.sh --no-build
./scripts/validate-all.sh --no-lint
```

---

## Core packages

| Package               | Purpose                                                                  | External deps       |
| --------------------- | ------------------------------------------------------------------------ | ------------------- |
| `@acme/kernel`        | DDD primitives (Entity, ValueObject, AggregateRoot, DomainEvent, Result) | **none**            |
| `@acme/application`   | Mediator, CQRS (MediatorRequest, RequestHandler, Pipeline behaviors)     | kernel              |
| `@acme/errors`        | ProblemDetails, HttpErrorMapper, AppError taxonomy                       | kernel              |
| `@acme/persistence`   | RepositoryPort, Page, UnitOfWork                                         | kernel              |
| `@acme/messaging`     | EventEnvelope, EventPublisherPort, FanOutBroker, TopicRouter             | kernel              |
| `@acme/observability` | Logger, InMemoryMetrics, LoggerFactory, PiiRedactor                      | kernel              |
| `@acme/resilience`    | CircuitBreaker, Retry, Timeout, Bulkhead                                 | kernel              |
| `@acme/security`      | JWT auth, API keys, RBAC, crypto utils                                   | kernel              |
| `@acme/eventsourcing` | EventSourcedAggregate, InMemoryEventStore, ProjectionRunner              | kernel              |
| `@acme/saga`          | Saga orchestration, SagaTransaction, compensation                        | kernel              |
| `@acme/outbox`        | Transactional outbox/inbox pattern                                       | kernel, messaging   |
| `@acme/testing`       | Test fakes, builders, test doubles                                       | kernel, application |

---

## Examples

Real, runnable examples live in `examples/` (excluded from TypeScript compilation; use `tsx` to run after `pnpm build`):

### DDD end-to-end

```bash
npx tsx examples/order-example.ts
```

Demonstrates: `Money` ValueObject → `Order` AggregateRoot → `ConfirmOrderCommand extends MediatorRequest<T>` → `Mediator` dispatch → `InMemoryOrderRepository` + `ConsoleEventPublisher`.

### Microservice wiring

```bash
npx tsx examples/microservice-example.ts
```

Demonstrates: `AggregateRoot`, `Mediator`, `Logger`, `InMemoryMetrics`, `HttpErrorMapper`, `AppError`.

### Event Sourcing

```bash
npx tsx examples/event-sourcing-example.ts
```

Demonstrates: `EventSourcedAggregate`, `InMemoryEventStore`, `loadFromHistory`, `ProjectionRunner`, and optimistic concurrency with `ConcurrencyError`.

---

## Minimal usage

### Domain aggregate

```typescript
import { AggregateRoot, Result } from '@acme/kernel';
import type { DomainEvent } from '@acme/kernel';
import { randomUUID } from 'node:crypto';

class OrderCreated implements DomainEvent {
  readonly occurredAt = new Date();
  constructor(readonly orderId: string) {}
}

class Order extends AggregateRoot<string> {
  private _status: 'PENDING' | 'CONFIRMED' = 'PENDING';

  private constructor(id: string) {
    super(id);
  }

  static create(): Order {
    const order = new Order(randomUUID());
    order.record(new OrderCreated(order.id));
    return order;
  }

  confirm(): Result<void, string> {
    if (this._status !== 'PENDING') return Result.fail('Already confirmed');
    this._status = 'CONFIRMED';
    return Result.ok(undefined);
  }
}
```

### CQRS with Mediator

```typescript
import { MediatorRequest, Mediator } from '@acme/application';
import type { RequestHandler } from '@acme/application';

class ConfirmOrderCommand extends MediatorRequest<{ orderId: string }> {
  constructor(readonly orderId: string) {
    super();
  }
}

class ConfirmOrderHandler implements RequestHandler<ConfirmOrderCommand, { orderId: string }> {
  async handle(cmd: ConfirmOrderCommand) {
    // ... load, mutate, save
    return { orderId: cmd.orderId };
  }
}

const mediator = new Mediator();
mediator.register(ConfirmOrderCommand, new ConfirmOrderHandler());
const result = await mediator.send(new ConfirmOrderCommand('ord-1'));
```

### Error mapping to HTTP Problem Details

```typescript
import { HttpErrorMapper } from '@acme/errors';
import { AppError, AppErrorCode } from '@acme/errors';

try {
  throw new AppError('Validation failed', AppErrorCode.VALIDATION_ERROR);
} catch (err) {
  const problem = HttpErrorMapper.toProblemDetails(err as Error);
  // { type, title, status: 422, detail: 'Validation failed' }
}
```

### Observability

```typescript
import { Logger, InMemoryMetrics } from '@acme/observability';

const logger = new Logger({ name: 'order-service' });
const metrics = new InMemoryMetrics();

logger.info('Order confirmed', { orderId: 'ord-1' });
metrics.incrementCounter('orders.confirmed');

const snapshot = metrics.getSnapshot();
// snapshot.counters → [{ name: 'orders.confirmed', value: 1, ... }]
```

---

## Architecture overview

```
Presentation  [@acme/web, @acme/web-graphql, @acme/bff]
      │
Application   [@acme/application]  ← commands, queries, mediator, pipeline
      │
Domain        [@acme/kernel]       ← zero external dependencies
      │
Infrastructure[@acme/persistence, @acme/messaging, @acme/eventsourcing, ...]
Cross-cutting [@acme/observability, @acme/errors, @acme/resilience, @acme/security]
```

---

## All 66 packages

Run `ls packages/` or see the [packages](./packages/) directory.

Each package has its own `README.md` with installation, API reference, and examples.

---

## Documentation

- [README.md](./README.md) — project overview
- [CHANGELOG.md](./CHANGELOG.md) — version history
- [docs/ADR.md](./docs/ADR.md) — Architecture Decision Records
- [docs/MIGRATION_GUIDE.md](./docs/MIGRATION_GUIDE.md) — migrating from monolith
- [examples/](./examples/) — runnable end-to-end examples
