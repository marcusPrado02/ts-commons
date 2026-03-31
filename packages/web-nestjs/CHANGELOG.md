# @marcusprado02/web-nestjs

## 0.2.0

### Minor Changes

- [`75a82ce`](https://github.com/marcusPrado02/ts-commons/commit/75a82ce4bd4750c5d24ffe5786c67bb4cf50ab11) Thanks [@marcusPrado02](https://github.com/marcusPrado02)! - Initial public release of all 66 packages to GitHub Packages under the `@marcusprado02` scope.

  ## Highlights

  ### Core DDD building blocks
  - **`@marcusprado02/kernel`** — `AggregateRoot`, `DomainEvent`, `Entity`, `Result<T, E>`, `ValueObject`
  - **`@marcusprado02/application`** — CQRS mediator (`Mediator`, `MediatorRequest`, `RequestHandler`), use-case base classes, command/query buses
  - **`@marcusprado02/persistence`** — `RepositoryPort<T, TId>`, `Page<T>`, `UnitOfWork` abstractions

  ### Infrastructure adapters
  - **`@marcusprado02/persistence-mongodb`** / **`-prisma`** / **`-typeorm`** — ORM-specific repository implementations
  - **`@marcusprado02/messaging`** — `EventEnvelope`, `FanOutBroker`, `TopicRouter`, `ContentRouter`
  - **`@marcusprado02/messaging-kafka`** / **`-rabbitmq`** / **`-eventbridge`** — message broker adapters
  - **`@marcusprado02/cache-redis`** — Redis cache with multi-level and warming strategies

  ### Reliability & observability
  - **`@marcusprado02/observability`** — structured `Logger`, metrics (`InMemoryMetrics`, `GrafanaMetricsExporter`, `DataDogMetricsExporter`), SLO tracking
  - **`@marcusprado02/eventsourcing`** — `EventSourcedAggregate`, `InMemoryEventStore`, `ProjectionRunner`, `ConcurrencyError`
  - **`@marcusprado02/outbox`** — transactional outbox + inbox patterns
  - **`@marcusprado02/resilience`** — circuit breaker, retry, bulkhead, rate limiter
  - **`@marcusprado02/errors`** — `AppError`, `AppErrorCode`, `HttpErrorMapper` (RFC 7807 Problem Details)

  ### Web framework integrations
  - **`@marcusprado02/web-nestjs`** — `ValidationPipe`, exception filters, correlation/logging interceptors, NestJS modules
  - **`@marcusprado02/web-express`** — Express middleware adapters
  - **`@marcusprado02/web-fastify`** — Fastify hook adapters

  ### Developer experience
  - **`@marcusprado02/testing`** — `InMemoryRepository`, `FakeClock`, test fixtures, Vitest matchers
  - **`@marcusprado02/security`** — JWT, API key, OIDC, RBAC, mTLS authenticators
  - **`@marcusprado02/secrets`** — `SecretsPort`, AWS SSM, env, cached, and fallback adapters
  - **`@marcusprado02/config`** — `ConfigSchema`, `ZodConfigSchema`, profile manager, config server
  - **`@marcusprado02/validation`** — `ZodValidator`, composite validators

### Patch Changes

- Updated dependencies [[`75a82ce`](https://github.com/marcusPrado02/ts-commons/commit/75a82ce4bd4750c5d24ffe5786c67bb4cf50ab11)]:
  - @marcusprado02/application@0.2.0
  - @marcusprado02/errors@0.2.0
  - @marcusprado02/kernel@0.2.0
  - @marcusprado02/observability@0.2.0
  - @marcusprado02/outbox@0.2.0
  - @marcusprado02/resilience@0.2.0
