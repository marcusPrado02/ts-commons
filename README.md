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

- **Zero dependencies in the core** — `@marcusprado02/kernel` has no runtime deps
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

| Package                    | Description                                                                                | Deps     |
| -------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| `@marcusprado02/kernel`    | `AggregateRoot`, `ValueObject`, `Entity`, `Result`, `DomainEvent`, `UUID`, `ULID`, `Clock` | **none** |
| `@marcusprado02/errors`    | Problem Details (RFC 7807), typed HTTP error hierarchy                                     | `kernel` |
| `@marcusprado02/contracts` | Shared API contracts, versioning primitives                                                | `kernel` |

### Application Layer

| Package                          | Description                                                                        | Deps                    |
| -------------------------------- | ---------------------------------------------------------------------------------- | ----------------------- |
| `@marcusprado02/application`     | `UseCase`, `CommandBus`, `QueryBus`, `Mediator`, `IdempotentUseCase`, `UnitOfWork` | `kernel`                |
| `@marcusprado02/validation`      | `ZodValidator`, `CompositeValidator`                                               | `kernel`                |
| `@marcusprado02/acl`             | Anti-Corruption Layer helpers                                                      | `kernel`                |
| `@marcusprado02/process-manager` | Long-running process coordination                                                  | `kernel`, `application` |

### Configuration & Secrets

| Package                    | Description                                                                  | Deps               |
| -------------------------- | ---------------------------------------------------------------------------- | ------------------ |
| `@marcusprado02/config`    | `ConfigServer`, `ProfileManager`, `HotReloadConfigLoader`, `ZodConfigSchema` | `kernel`           |
| `@marcusprado02/secrets`   | Port + adapters: Env, AWS SSM, Vault, `CachedSecretsAdapter`                 | `kernel`           |
| `@marcusprado02/features`  | Feature flags with environment-aware evaluation                              | `kernel`, `config` |
| `@marcusprado02/hotreload` | Hot-reload for any configuration source                                      | `config`           |

### Persistence

| Package                              | Description                                          | Deps                    |
| ------------------------------------ | ---------------------------------------------------- | ----------------------- |
| `@marcusprado02/persistence`         | `RepositoryPort<T>`, `Page<T>`, pagination helpers   | `kernel`                |
| `@marcusprado02/persistence-prisma`  | `PrismaRepository`, `PrismaUnitOfWork`               | `persistence`           |
| `@marcusprado02/persistence-mongodb` | `MongoRepository`, `MongoUnitOfWork`                 | `persistence`           |
| `@marcusprado02/persistence-typeorm` | `TypeOrmRepository`, `TypeOrmUnitOfWork`             | `persistence`           |
| `@marcusprado02/eventsourcing`       | Event store, event-sourced aggregate base, snapshots | `kernel`, `persistence` |
| `@marcusprado02/schema-registry`     | Schema registry port + Confluent/Glue adapters       | `kernel`                |

### Messaging

| Package                                | Description                                                    | Deps                  |
| -------------------------------------- | -------------------------------------------------------------- | --------------------- |
| `@marcusprado02/messaging`             | `EventPublisherPort`, `EventEnvelope`, consumer port           | `kernel`              |
| `@marcusprado02/messaging-kafka`       | `KafkaEventPublisher`, `KafkaEventConsumer`, `KafkaConnection` | `messaging`           |
| `@marcusprado02/messaging-rabbitmq`    | `RabbitMQEventPublisher`, `RabbitMQEventConsumer`              | `messaging`           |
| `@marcusprado02/messaging-eventbridge` | AWS EventBridge adapter                                        | `messaging`           |
| `@marcusprado02/outbox`                | Transactional outbox/inbox, `OutboxRelay`, `OutboxStorePort`   | `kernel`, `messaging` |
| `@marcusprado02/cdc`                   | Change Data Capture + Debezium adapter                         | `messaging`           |
| `@marcusprado02/streams`               | Stream processing primitives                                   | `messaging`           |

### Application Patterns

| Package                      | Description                                                         | Deps          |
| ---------------------------- | ------------------------------------------------------------------- | ------------- |
| `@marcusprado02/saga`        | `SagaTransaction` + compensation, `SagaChoreography`, `SagaMonitor` | `application` |
| `@marcusprado02/resilience`  | `CircuitBreaker`, `Retry`, `Timeout`, `RateLimiter`, `Bulkhead`     | `kernel`      |
| `@marcusprado02/scheduler`   | `InMemoryScheduler`, cron (`CronParser`), `IntervalRunner`          | `kernel`      |
| `@marcusprado02/cache-redis` | `RedisCache`, `MultiLevelCache`, `RedisLock`, `RedisPubSub`         | `kernel`      |

### Security

| Package                   | Description                                                                                  | Deps     |
| ------------------------- | -------------------------------------------------------------------------------------------- | -------- |
| `@marcusprado02/security` | `JwtAuthenticator`, `RbacPolicyEngine`, `AesGcmCipher`, `PiiMasker`, `ClientCredentialsFlow` | `kernel` |

### Observability

| Package                             | Description                                                                       | Deps                      |
| ----------------------------------- | --------------------------------------------------------------------------------- | ------------------------- |
| `@marcusprado02/observability`      | `LoggerFactory`, `PiiRedactor`, `MetricsPort`, `SloTracker`, `PerformanceMonitor` | `kernel`                  |
| `@marcusprado02/observability-otel` | `OtelTracer`, `AdvancedTracer` (OpenTelemetry)                                    | `observability`           |
| `@marcusprado02/audit`              | Audit trail port + adapters                                                       | `kernel`, `observability` |
| `@marcusprado02/incidents`          | Incident management (PagerDuty, OpsGenie)                                         | `observability`           |
| `@marcusprado02/synthetic`          | Synthetic monitoring / canary checks                                              | `observability`           |

### Web & API

| Package                      | Description                                                       | Deps                 |
| ---------------------------- | ----------------------------------------------------------------- | -------------------- |
| `@marcusprado02/web`         | HTTP adapter base types: `HttpContext`, error mappers             | `kernel`, `errors`   |
| `@marcusprado02/web-fastify` | `FastifyControllerAdapter`, `CorrelationHook`, `ErrorHandlerHook` | `web`                |
| `@marcusprado02/web-nestjs`  | `CommonsCoreModule`, interceptors, guards, decorators             | `web`, `application` |
| `@marcusprado02/web-express` | Express middleware and controller adapter                         | `web`                |
| `@marcusprado02/web-graphql` | GraphQL schema helpers and context types                          | `web`                |
| `@marcusprado02/bff`         | Backend-for-Frontend adapter utilities                            | `web`                |
| `@marcusprado02/gateway`     | API gateway routing & composition                                 | `web`, `resilience`  |
| `@marcusprado02/websocket`   | WebSocket port + Socket.io adapter                                | `web`                |

### Platform

| Package                       | Description                                                | Deps           |
| ----------------------------- | ---------------------------------------------------------- | -------------- |
| `@marcusprado02/docker-utils` | `GracefulShutdown`, `HealthAggregator`, liveness/readiness | `kernel`       |
| `@marcusprado02/k8s`          | Kubernetes client helpers, ConfigMap watcher               | `config`       |
| `@marcusprado02/helm`         | Helm chart templates                                       | —              |
| `@marcusprado02/terraform`    | Terraform modules                                          | —              |
| `@marcusprado02/service-mesh` | Istio/Linkerd configuration helpers                        | `docker-utils` |
| `@marcusprado02/discovery`    | Service discovery port + Consul/Eureka adapters            | `kernel`       |

### Data & Analytics

| Package                         | Description                                      | Deps            |
| ------------------------------- | ------------------------------------------------ | --------------- |
| `@marcusprado02/data-pipeline`  | Data pipeline primitives                         | `kernel`        |
| `@marcusprado02/data-quality`   | Data quality rules and validation                | `validation`    |
| `@marcusprado02/data-warehouse` | Data warehouse adapter ports                     | `persistence`   |
| `@marcusprado02/analytics`      | Event analytics and metrics aggregation          | `observability` |
| `@marcusprado02/timeseries`     | Time-series port + InfluxDB/TimescaleDB adapters | `persistence`   |
| `@marcusprado02/geospatial`     | Geospatial value objects and query helpers       | `kernel`        |

### Communication

| Package                        | Description                                      | Deps          |
| ------------------------------ | ------------------------------------------------ | ------------- |
| `@marcusprado02/email`         | Email port + SES/SendGrid/SMTP adapters          | `kernel`      |
| `@marcusprado02/notifications` | Multi-channel notifications (push, SMS, email)   | `kernel`      |
| `@marcusprado02/search`        | Search port + Elasticsearch/OpenSearch adapters  | `persistence` |
| `@marcusprado02/storage`       | Object storage port + S3/GCS/Azure Blob adapters | `kernel`      |

### Developer Tooling

| Package                             | Description                                                 | Deps                    |
| ----------------------------------- | ----------------------------------------------------------- | ----------------------- |
| `@marcusprado02/testing`            | `Builder<T>`, `FakeClock`, Vitest matchers, in-memory fakes | `kernel`, `application` |
| `@marcusprado02/architecture-tests` | Fitness functions: enforce layer rules at test time         | `kernel`                |
| `@marcusprado02/codegen`            | Code generation templates for DDD artifacts                 | —                       |
| `@marcusprado02/cli`                | CLI scaffolding tool                                        | `codegen`               |
| `@marcusprado02/vscode-extension`   | VS Code extension for template generation                   | `codegen`               |

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                       Your Microservice                        │
│                                                                │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │    Domain    │  │   Application    │  │   Transport    │  │
│  │ @marcusprado02/kernel │◄─│ @marcusprado02/application│◄─│ @marcusprado02/web-*    │  │
│  │ @marcusprado02/errors │  │ @marcusprado02/validation │  │                │  │
│  └──────────────┘  └──────────────────┘  └────────────────┘  │
│                             │                                  │
│                   ┌─────────▼──────────┐                      │
│                   │  Infrastructure    │                      │
│                   │  @marcusprado02/persistence-│                      │
│                   │  @marcusprado02/messaging-* │                      │
│                   │  @marcusprado02/cache-redis │                      │
│                   │  @marcusprado02/security    │                      │
│                   │  @marcusprado02/observ*     │                      │
│                   │  @marcusprado02/config      │                      │
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
