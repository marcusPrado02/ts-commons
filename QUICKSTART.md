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
pnpm --filter @marcusprado02/kernel exec vitest run
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

| Package                        | Purpose                                                                  | External deps       |
| ------------------------------ | ------------------------------------------------------------------------ | ------------------- |
| `@marcusprado02/kernel`        | DDD primitives (Entity, ValueObject, AggregateRoot, DomainEvent, Result) | **none**            |
| `@marcusprado02/application`   | Mediator, CQRS (MediatorRequest, RequestHandler, Pipeline behaviors)     | kernel              |
| `@marcusprado02/errors`        | ProblemDetails, HttpErrorMapper, AppError taxonomy                       | kernel              |
| `@marcusprado02/persistence`   | RepositoryPort, Page, UnitOfWork                                         | kernel              |
| `@marcusprado02/messaging`     | EventEnvelope, EventPublisherPort, FanOutBroker, TopicRouter             | kernel              |
| `@marcusprado02/observability` | Logger, InMemoryMetrics, LoggerFactory, PiiRedactor                      | kernel              |
| `@marcusprado02/resilience`    | CircuitBreaker, Retry, Timeout, Bulkhead                                 | kernel              |
| `@marcusprado02/security`      | JWT auth, API keys, RBAC, crypto utils                                   | kernel              |
| `@marcusprado02/eventsourcing` | EventSourcedAggregate, InMemoryEventStore, ProjectionRunner              | kernel              |
| `@marcusprado02/saga`          | Saga orchestration, SagaTransaction, compensation                        | kernel              |
| `@marcusprado02/outbox`        | Transactional outbox/inbox pattern                                       | kernel, messaging   |
| `@marcusprado02/testing`       | Test fakes, builders, test doubles                                       | kernel, application |

---

## Examples

Real, runnable examples live in `examples/`. They use tsx with path aliases pointing to source files (no compile step needed):

### DDD end-to-end

```bash
npx tsx --tsconfig examples/tsconfig.json examples/order-example.ts
```

Demonstrates: `Money` ValueObject → `Order extends AggregateRoot<string>` → `ConfirmOrderCommand extends MediatorRequest<T>` → `Mediator` dispatch → `InMemoryOrderRepository`.

### Microservice wiring

```bash
npx tsx --tsconfig examples/tsconfig.json examples/microservice-example.ts
```

Demonstrates: `AggregateRoot`, `Mediator`, `Logger`, `InMemoryMetrics`, `HttpErrorMapper`, `AppError`.

### Event Sourcing

```bash
npx tsx --tsconfig examples/tsconfig.json examples/event-sourcing-example.ts
```

Demonstrates: `EventSourcedAggregate`, `InMemoryEventStore`, `loadFromHistory`, `ProjectionRunner`, and optimistic concurrency with `ConcurrencyError`.

---

## Minimal usage

### Domain aggregate

```typescript
import { AggregateRoot, Result } from '@marcusprado02/kernel';
import type { DomainEvent } from '@marcusprado02/kernel';
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
import { MediatorRequest, Mediator } from '@marcusprado02/application';
import type { RequestHandler } from '@marcusprado02/application';

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
import { HttpErrorMapper } from '@marcusprado02/errors';
import { AppError, AppErrorCode } from '@marcusprado02/errors';

try {
  throw new AppError('Validation failed', AppErrorCode.VALIDATION_ERROR);
} catch (err) {
  const problem = HttpErrorMapper.toProblemDetails(err as Error);
  // { type, title, status: 422, detail: 'Validation failed' }
}
```

### Observability

```typescript
import { Logger, InMemoryMetrics } from '@marcusprado02/observability';

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
Presentation  [@marcusprado02/web, @marcusprado02/web-graphql, @marcusprado02/bff]
      │
Application   [@marcusprado02/application]  ← commands, queries, mediator, pipeline
      │
Domain        [@marcusprado02/kernel]       ← zero external dependencies
      │
Infrastructure[@marcusprado02/persistence, @marcusprado02/messaging, @marcusprado02/eventsourcing, ...]
Cross-cutting [@marcusprado02/observability, @marcusprado02/errors, @marcusprado02/resilience, @marcusprado02/security]
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
