# Architecture

This document describes the architectural principles, layer rules, and design decisions behind ts-commons.

---

## Core Principles

### 1. Clean Architecture — Dependency Rule

Dependencies flow **inward only**. Inner layers are completely unaware of outer layers.

```
Transport  (HTTP, WebSocket, CLI)
    │
    ▼
Infrastructure  (persistence, messaging, cache, config, secrets)
    │
    ▼
Application  (use cases, CQRS, behaviors)
    │
    ▼
Domain / Kernel  (aggregates, value objects, domain events, results)
```

- `@marcusprado02/kernel` has zero runtime dependencies.
- `@marcusprado02/application` depends only on `@marcusprado02/kernel`.
- Infrastructure packages (`persistence-*`, `messaging-*`, etc.) depend on `kernel` and `application` — never the other way round.
- Transport packages (`web-fastify`, `web-nestjs`, etc.) sit at the outermost ring.

### 2. Hexagonal Architecture (Ports & Adapters)

Every infrastructure concern is expressed as a **Port** (interface) defined in the inner layer, and an **Adapter** (concrete class) in the outer layer.

| Port                 | Where defined                  | Example adapters                                |
| -------------------- | ------------------------------ | ----------------------------------------------- |
| `RepositoryPort<T>`  | `@marcusprado02/persistence`   | `PrismaRepository`, `MongoRepository`           |
| `EventPublisherPort` | `@marcusprado02/messaging`     | `KafkaEventPublisher`, `RabbitMQEventPublisher` |
| `SecretsPort`        | `@marcusprado02/secrets`       | `AwsSsmSecretsAdapter`, `EnvSecretsAdapter`     |
| `MetricsPort`        | `@marcusprado02/observability` | `DataDogMetrics`, `InMemoryMetrics`             |

You can swap any adapter without changing domain or application code.

### 3. Domain-Driven Design

- **Aggregates** — enforce consistency boundaries. All state changes go through the aggregate root.
- **Value Objects** — immutable, compared by value, invariants enforced in factory methods.
- **Domain Events** — aggregates record events; the application layer publishes them after persistence.
- **Repository** — abstracts persistence; the domain layer only sees `RepositoryPort<T>`.

### 4. CQRS (Command / Query Responsibility Segregation)

Commands mutate state and return `Result<void | scalar, Error>`.
Queries are read-only and return DTOs.
Both flow through `CommandBus` and `QueryBus` (or a `Mediator`).

### 5. Railway-Oriented Programming

Every operation that can fail returns `Result<T, E>` instead of throwing.

```typescript
const result = Order.place(id, items)
  .flatMap((order) => inventory.reserve(order.items))
  .map((order) => order.id.value);
```

This makes error paths explicit, composable, and testable.

### 6. 12-Factor App

| Factor                | Package                                                      |
| --------------------- | ------------------------------------------------------------ |
| III — Config          | `@marcusprado02/config`                                      |
| IV — Backing services | `@marcusprado02/persistence-*`, `@marcusprado02/messaging-*` |
| VII — Port binding    | `@marcusprado02/web-fastify`, `@marcusprado02/web-nestjs`    |
| VIII — Concurrency    | `@marcusprado02/scheduler`, `@marcusprado02/saga`            |
| IX — Disposability    | `@marcusprado02/docker-utils` (`GracefulShutdown`)           |
| XI — Logs             | `@marcusprado02/observability`                               |

---

## Layer Rules (enforced by `@marcusprado02/architecture-tests`)

```
✅ kernel      → nothing (no deps allowed)
✅ application → kernel
✅ infrastr.   → kernel, application
✅ transport   → kernel, application, infrastructure
❌ kernel      → application  (forbidden)
❌ kernel      → infrastructure  (forbidden)
❌ application → infrastructure  (forbidden)
```

Violations are caught at test time via fitness functions in `@marcusprado02/architecture-tests`.

---

## Aggregate Lifecycle

```
1. Command arrives at UseCase
        │
2. Load aggregate from repository
        │
3. Call aggregate method (validates invariants, records domain events)
        │
4. Persist aggregate + outbox entries in a single transaction (UnitOfWork)
        │
5. OutboxRelay polls and publishes events to message broker
        │
6. Downstream services consume events via their EventConsumer
```

This pattern guarantees **at-least-once delivery** with no dual-write problems.

---

## Multi-Tenancy

`TenantContext` (in `@marcusprado02/kernel`) uses `AsyncLocalStorage` to propagate the current tenant ID transparently through the call stack.

```typescript
TenantContext.run(TenantId.from('tenant-abc'), async () => {
  // all repository calls, logs, metrics queries automatically include tenantId
  await placeOrderUseCase.execute(input);
});
```

---

## Event Sourcing (optional)

`@marcusprado02/eventsourcing` provides an event-sourced aggregate base on top of `@marcusprado02/kernel`.
Aggregates are reconstituted by replaying their event stream from the event store.
Snapshots are supported to avoid replaying the entire history on every load.

---

## Observability Model

```
Request (correlationId, traceId)
    │
    ├─► Logger (structured JSON, PII redacted)
    │
    ├─► Tracer (OtelTracer — distributed trace spans)
    │
    ├─► Metrics (counters, histograms, gauges)
    │
    └─► SloTracker (error budget, availability)
```

Every log line, trace span, and metric carries `correlationId`, `tenantId`, and `serviceId`.

---

## Architecture Decision Records

See [docs/ADR.md](ADR.md) for the full list of ADRs. Key decisions:

| ADR                                          | Decision                                                 |
| -------------------------------------------- | -------------------------------------------------------- |
| [ADR-0006](ADR-0006-module-resolution.md)    | Module resolution strategy                               |
| [ADR-0007](ADR-0007-esm-vs-commonjs.md)      | ESM-only, no dual build                                  |
| [ADR-0008](ADR-0008-dependency-injection.md) | Manual constructor injection (no DI container in kernel) |
| [ADR-0009](ADR-0009-testing-strategy.md)     | Test pyramid: unit → integration → contract → e2e        |
| [ADR-0010](ADR-0010-error-handling.md)       | Railway-oriented programming with `Result<T, E>`         |
