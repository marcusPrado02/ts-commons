# ts-commons

> Enterprise-grade TypeScript building blocks for modern microservices.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-%E2%89%A520-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-orange.svg)](https://pnpm.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/marcusPrado02/ts-commons/actions/workflows/ci.yml/badge.svg)](https://github.com/marcusPrado02/ts-commons/actions/workflows/ci.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A monorepo of **65+ focused TypeScript packages** implementing Clean Architecture, Domain-Driven Design (DDD), CQRS, Hexagonal Architecture, and 12-Factor principles — so your microservices start on solid foundations, not boilerplate.

---

## Principles

- **Zero dependencies in the core** — `@acme/kernel` has no runtime deps
- **Port / Adapter everywhere** — swap infrastructure without touching domain code
- **12-Factor compliant** — config, secrets, logging, disposability all covered
- **Railway-Oriented Programming** — `Result<T, E>` replaces thrown exceptions
- **Observability first** — structured logs, metrics, and traces built in

---

## Quick Start

```bash
pnpm install      # install all workspace dependencies
pnpm build        # build all packages (topological order)
pnpm test         # run all tests
pnpm lint         # lint
pnpm typecheck    # type-check
```

Minimum requirements: **Node ≥ 20**, **pnpm ≥ 8**

---

## Package Catalogue

### Domain Layer

| Package           | Description                                                                                | Deps     |
| ----------------- | ------------------------------------------------------------------------------------------ | -------- |
| `@acme/kernel`    | `AggregateRoot`, `ValueObject`, `Entity`, `Result`, `DomainEvent`, `UUID`, `ULID`, `Clock` | **none** |
| `@acme/errors`    | Problem Details (RFC 7807), typed HTTP error hierarchy                                     | `kernel` |
| `@acme/contracts` | Shared API contracts, versioning primitives                                                | `kernel` |

### Application Layer

| Package                 | Description                                                                        | Deps                    |
| ----------------------- | ---------------------------------------------------------------------------------- | ----------------------- |
| `@acme/application`     | `UseCase`, `CommandBus`, `QueryBus`, `Mediator`, `IdempotentUseCase`, `UnitOfWork` | `kernel`                |
| `@acme/validation`      | `ZodValidator`, `CompositeValidator`                                               | `kernel`                |
| `@acme/acl`             | Anti-Corruption Layer helpers                                                      | `kernel`                |
| `@acme/process-manager` | Long-running process coordination                                                  | `kernel`, `application` |

### Configuration & Secrets

| Package           | Description                                                                  | Deps               |
| ----------------- | ---------------------------------------------------------------------------- | ------------------ |
| `@acme/config`    | `ConfigServer`, `ProfileManager`, `HotReloadConfigLoader`, `ZodConfigSchema` | `kernel`           |
| `@acme/secrets`   | Port + adapters: Env, AWS SSM, Vault, `CachedSecretsAdapter`                 | `kernel`           |
| `@acme/features`  | Feature flags with environment-aware evaluation                              | `kernel`, `config` |
| `@acme/hotreload` | Hot-reload for any configuration source                                      | `config`           |

### Persistence

| Package                     | Description                                          | Deps                    |
| --------------------------- | ---------------------------------------------------- | ----------------------- |
| `@acme/persistence`         | `RepositoryPort<T>`, `Page<T>`, pagination helpers   | `kernel`                |
| `@acme/persistence-prisma`  | `PrismaRepository`, `PrismaUnitOfWork`               | `persistence`           |
| `@acme/persistence-mongodb` | `MongoRepository`, `MongoUnitOfWork`                 | `persistence`           |
| `@acme/persistence-typeorm` | `TypeOrmRepository`, `TypeOrmUnitOfWork`             | `persistence`           |
| `@acme/eventsourcing`       | Event store, event-sourced aggregate base, snapshots | `kernel`, `persistence` |
| `@acme/schema-registry`     | Schema registry port + Confluent/Glue adapters       | `kernel`                |

### Messaging

| Package                       | Description                                                    | Deps                  |
| ----------------------------- | -------------------------------------------------------------- | --------------------- |
| `@acme/messaging`             | `EventPublisherPort`, `EventEnvelope`, consumer port           | `kernel`              |
| `@acme/messaging-kafka`       | `KafkaEventPublisher`, `KafkaEventConsumer`, `KafkaConnection` | `messaging`           |
| `@acme/messaging-rabbitmq`    | `RabbitMQEventPublisher`, `RabbitMQEventConsumer`              | `messaging`           |
| `@acme/messaging-eventbridge` | AWS EventBridge adapter                                        | `messaging`           |
| `@acme/outbox`                | Transactional outbox/inbox, `OutboxRelay`, `OutboxStorePort`   | `kernel`, `messaging` |
| `@acme/cdc`                   | Change Data Capture + Debezium adapter                         | `messaging`           |
| `@acme/streams`               | Stream processing primitives                                   | `messaging`           |

### Application Patterns

| Package             | Description                                                         | Deps          |
| ------------------- | ------------------------------------------------------------------- | ------------- |
| `@acme/saga`        | `SagaTransaction` + compensation, `SagaChoreography`, `SagaMonitor` | `application` |
| `@acme/resilience`  | `CircuitBreaker`, `Retry`, `Timeout`, `RateLimiter`, `Bulkhead`     | `kernel`      |
| `@acme/scheduler`   | `InMemoryScheduler`, cron (`CronParser`), `IntervalRunner`          | `kernel`      |
| `@acme/cache-redis` | `RedisCache`, `MultiLevelCache`, `RedisLock`, `RedisPubSub`         | `kernel`      |

### Security

| Package          | Description                                                                                  | Deps     |
| ---------------- | -------------------------------------------------------------------------------------------- | -------- |
| `@acme/security` | `JwtAuthenticator`, `RbacPolicyEngine`, `AesGcmCipher`, `PiiMasker`, `ClientCredentialsFlow` | `kernel` |

### Observability

| Package                    | Description                                                                       | Deps                      |
| -------------------------- | --------------------------------------------------------------------------------- | ------------------------- |
| `@acme/observability`      | `LoggerFactory`, `PiiRedactor`, `MetricsPort`, `SloTracker`, `PerformanceMonitor` | `kernel`                  |
| `@acme/observability-otel` | `OtelTracer`, `AdvancedTracer` (OpenTelemetry)                                    | `observability`           |
| `@acme/audit`              | Audit trail port + adapters                                                       | `kernel`, `observability` |
| `@acme/incidents`          | Incident management (PagerDuty, OpsGenie)                                         | `observability`           |
| `@acme/synthetic`          | Synthetic monitoring / canary checks                                              | `observability`           |

### Web & API

| Package             | Description                                                       | Deps                 |
| ------------------- | ----------------------------------------------------------------- | -------------------- |
| `@acme/web`         | HTTP adapter base types: `HttpContext`, error mappers             | `kernel`, `errors`   |
| `@acme/web-fastify` | `FastifyControllerAdapter`, `CorrelationHook`, `ErrorHandlerHook` | `web`                |
| `@acme/web-nestjs`  | `CommonsCoreModule`, interceptors, guards, decorators             | `web`, `application` |
| `@acme/web-express` | Express middleware and controller adapter                         | `web`                |
| `@acme/web-graphql` | GraphQL schema helpers and context types                          | `web`                |
| `@acme/bff`         | Backend-for-Frontend adapter utilities                            | `web`                |
| `@acme/gateway`     | API gateway routing & composition                                 | `web`, `resilience`  |
| `@acme/websocket`   | WebSocket port + Socket.io adapter                                | `web`                |

### Platform

| Package              | Description                                                | Deps           |
| -------------------- | ---------------------------------------------------------- | -------------- |
| `@acme/docker-utils` | `GracefulShutdown`, `HealthAggregator`, liveness/readiness | `kernel`       |
| `@acme/k8s`          | Kubernetes client helpers, ConfigMap watcher               | `config`       |
| `@acme/helm`         | Helm chart templates                                       | —              |
| `@acme/terraform`    | Terraform modules                                          | —              |
| `@acme/service-mesh` | Istio/Linkerd configuration helpers                        | `docker-utils` |
| `@acme/discovery`    | Service discovery port + Consul/Eureka adapters            | `kernel`       |

### Data & Analytics

| Package                | Description                                      | Deps            |
| ---------------------- | ------------------------------------------------ | --------------- |
| `@acme/data-pipeline`  | Data pipeline primitives                         | `kernel`        |
| `@acme/data-quality`   | Data quality rules and validation                | `validation`    |
| `@acme/data-warehouse` | Data warehouse adapter ports                     | `persistence`   |
| `@acme/analytics`      | Event analytics and metrics aggregation          | `observability` |
| `@acme/timeseries`     | Time-series port + InfluxDB/TimescaleDB adapters | `persistence`   |
| `@acme/geospatial`     | Geospatial value objects and query helpers       | `kernel`        |

### Communication

| Package               | Description                                      | Deps          |
| --------------------- | ------------------------------------------------ | ------------- |
| `@acme/email`         | Email port + SES/SendGrid/SMTP adapters          | `kernel`      |
| `@acme/notifications` | Multi-channel notifications (push, SMS, email)   | `kernel`      |
| `@acme/search`        | Search port + Elasticsearch/OpenSearch adapters  | `persistence` |
| `@acme/storage`       | Object storage port + S3/GCS/Azure Blob adapters | `kernel`      |

### Developer Tooling

| Package                    | Description                                                 | Deps                    |
| -------------------------- | ----------------------------------------------------------- | ----------------------- |
| `@acme/testing`            | `Builder<T>`, `FakeClock`, Vitest matchers, in-memory fakes | `kernel`, `application` |
| `@acme/architecture-tests` | Fitness functions: enforce layer rules at test time         | `kernel`                |
| `@acme/codegen`            | Code generation templates for DDD artifacts                 | —                       |
| `@acme/cli`                | CLI scaffolding tool                                        | `codegen`               |
| `@acme/vscode-extension`   | VS Code extension for template generation                   | `codegen`               |

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                       Your Microservice                        │
│                                                                │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │    Domain    │  │   Application    │  │   Transport    │  │
│  │ @acme/kernel │◄─│ @acme/application│◄─│ @acme/web-*    │  │
│  │ @acme/errors │  │ @acme/validation │  │                │  │
│  └──────────────┘  └──────────────────┘  └────────────────┘  │
│                             │                                  │
│                   ┌─────────▼──────────┐                      │
│                   │  Infrastructure    │                      │
│                   │  @acme/persistence-│                      │
│                   │  @acme/messaging-* │                      │
│                   │  @acme/cache-redis │                      │
│                   │  @acme/security    │                      │
│                   │  @acme/observ*     │                      │
│                   │  @acme/config      │                      │
│                   └────────────────────┘                      │
└────────────────────────────────────────────────────────────────┘
```

**Dependency rule:** `kernel` ← `application` ← `infrastructure` ← `transport`
Inner layers never import outer layers.

---

## Documentation

| Document                                                                         | Description                              |
| -------------------------------------------------------------------------------- | ---------------------------------------- |
| [docs/getting-started.md](docs/getting-started.md)                               | Install, build, first usage              |
| [docs/architecture.md](docs/architecture.md)                                     | Architecture principles and layer rules  |
| [docs/packages/kernel.md](docs/packages/kernel.md)                               | `Result`, `ValueObject`, `AggregateRoot` |
| [docs/packages/application.md](docs/packages/application.md)                     | Use cases, CQRS, Mediator                |
| [docs/packages/config.md](docs/packages/config.md)                               | Configuration and hot-reload             |
| [docs/packages/secrets.md](docs/packages/secrets.md)                             | Secrets management                       |
| [docs/packages/validation.md](docs/packages/validation.md)                       | Input validation                         |
| [docs/packages/persistence.md](docs/packages/persistence.md)                     | Repositories and pagination              |
| [docs/packages/messaging.md](docs/packages/messaging.md)                         | Events, Kafka, RabbitMQ                  |
| [docs/packages/outbox.md](docs/packages/outbox.md)                               | Transactional outbox pattern             |
| [docs/packages/saga.md](docs/packages/saga.md)                                   | Saga and compensation flows              |
| [docs/packages/resilience.md](docs/packages/resilience.md)                       | Circuit breaker, retry, rate limiter     |
| [docs/packages/security.md](docs/packages/security.md)                           | Auth, RBAC, encryption                   |
| [docs/packages/observability.md](docs/packages/observability.md)                 | Logs, metrics, tracing, SLOs             |
| [docs/packages/docker-utils.md](docs/packages/docker-utils.md)                   | Health checks, graceful shutdown         |
| [docs/packages/web.md](docs/packages/web.md)                                     | Fastify and NestJS adapters              |
| [docs/packages/cache-redis.md](docs/packages/cache-redis.md)                     | Redis cache, locks, pub/sub              |
| [docs/packages/scheduler.md](docs/packages/scheduler.md)                         | Cron and interval jobs                   |
| [docs/packages/testing.md](docs/packages/testing.md)                             | Test builders, fakes, matchers           |
| [docs/guides/building-a-microservice.md](docs/guides/building-a-microservice.md) | End-to-end walkthrough                   |
| [docs/guides/testing-strategy.md](docs/guides/testing-strategy.md)               | Testing patterns                         |
| [COMMANDS.md](COMMANDS.md)                                                       | All pnpm commands reference              |
| [CONTRIBUTING.md](CONTRIBUTING.md)                                               | Contribution guide                       |
| [docs/ADR.md](docs/ADR.md)                                                       | Architecture Decision Records index      |
| [docs/MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md)                               | Migration guide                          |

---

## Conventions

- **Commit format:** `type(scope): description` — max 100 chars, [Conventional Commits](https://www.conventionalcommits.org/)
- **Branch naming:** `feat/`, `fix/`, `chore/`, `docs/`
- **Tests:** Vitest, co-located with source (`*.spec.ts`)
- **Code style:** ESLint strict + Prettier (enforced via pre-commit hook)
- **Imports:** ESM only — no CommonJS

## License

MIT
