---
'@marcusprado02/acl': minor
'@marcusprado02/analytics': minor
'@marcusprado02/application': minor
'@marcusprado02/architecture-tests': minor
'@marcusprado02/audit': minor
'@marcusprado02/bff': minor
'@marcusprado02/cache-redis': minor
'@marcusprado02/cdc': minor
'@marcusprado02/chaos': minor
'@marcusprado02/cli': minor
'@marcusprado02/codegen': minor
'@marcusprado02/config': minor
'@marcusprado02/contracts': minor
'@marcusprado02/data-pipeline': minor
'@marcusprado02/data-quality': minor
'@marcusprado02/data-warehouse': minor
'@marcusprado02/discovery': minor
'@marcusprado02/docker-utils': minor
'@marcusprado02/docs': minor
'@marcusprado02/email': minor
'@marcusprado02/errors': minor
'@marcusprado02/eventsourcing': minor
'@marcusprado02/features': minor
'@marcusprado02/gateway': minor
'@marcusprado02/geospatial': minor
'@marcusprado02/helm': minor
'@marcusprado02/hotreload': minor
'@marcusprado02/incidents': minor
'@marcusprado02/k8s': minor
'@marcusprado02/kernel': minor
'@marcusprado02/messaging': minor
'@marcusprado02/messaging-eventbridge': minor
'@marcusprado02/messaging-kafka': minor
'@marcusprado02/messaging-rabbitmq': minor
'@marcusprado02/notifications': minor
'@marcusprado02/observability': minor
'@marcusprado02/observability-otel': minor
'@marcusprado02/outbox': minor
'@marcusprado02/persistence': minor
'@marcusprado02/persistence-mongodb': minor
'@marcusprado02/persistence-prisma': minor
'@marcusprado02/persistence-typeorm': minor
'@marcusprado02/process-manager': minor
'@marcusprado02/resilience': minor
'@marcusprado02/saga': minor
'@marcusprado02/scheduler': minor
'@marcusprado02/schema-registry': minor
'@marcusprado02/search': minor
'@marcusprado02/secrets': minor
'@marcusprado02/security': minor
'@marcusprado02/service-mesh': minor
'@marcusprado02/storage': minor
'@marcusprado02/streams': minor
'@marcusprado02/synthetic': minor
'@marcusprado02/terraform': minor
'@marcusprado02/testing': minor
'@marcusprado02/timeseries': minor
'@marcusprado02/tutorials': minor
'@marcusprado02/validation': minor
'@marcusprado02/vscode-extension': minor
'@marcusprado02/web': minor
'@marcusprado02/web-express': minor
'@marcusprado02/web-fastify': minor
'@marcusprado02/web-graphql': minor
'@marcusprado02/web-nestjs': minor
'@marcusprado02/websocket': minor
---

Initial public release of all 66 packages to GitHub Packages under the `@marcusprado02` scope.

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
