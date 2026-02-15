# @acme/ts-commons

**Biblioteca compartilhada TypeScript** para microserviços com princípios de Clean Architecture, Hexagonal Architecture, DDD, CQRS, e padrões enterprise de produção.

## 🎯 Princípios de Design

- **Kernel (domínio) não depende de infra/framework** - Zero vazamento de dependências
- **Tudo que é "integração" fica em adapters/infra packages**
- **Pacotes versionados e estáveis** com API pública mínima
- **Erro, logging, tracing, config padronizados**
- **Multi-tenant, idempotência, outbox/inbox, correlation/causation** como cidadãos de primeira classe
- **Baterias incluídas** com sane defaults, mas **pluggable**

## 📦 Pacotes

### Core (Zero Framework Dependencies)
- **[@acme/kernel](./packages/kernel)** - DDD primitives: Entity, AggregateRoot, ValueObject, DomainEvent
- **[@acme/application](./packages/application)** - Use cases, CQRS primitives, validation
- **[@acme/errors](./packages/errors)** - Problem Details, error taxonomy, HTTP error mapping

### Configuration & Observability
- **[@acme/config](./packages/config)** - 12-factor config loader com schema validation
- **[@acme/observability](./packages/observability)** - Logging, metrics, tracing (OpenTelemetry)

### Resilience & Security
- **[@acme/resilience](./packages/resilience)** - Retry, timeout, circuit-breaker, bulkhead, rate-limit
- **[@acme/security](./packages/security)** - AuthN/AuthZ, crypto, PII masking, audit

### Messaging & Persistence
- **[@acme/messaging](./packages/messaging)** - Event envelope, publisher/subscriber interfaces
- **[@acme/outbox](./packages/outbox)** - Transactional outbox/inbox + idempotency
- **[@acme/persistence](./packages/persistence)** - Repository abstractions, UnitOfWork, pagination

### API & Adapters
- **[@acme/contracts](./packages/contracts)** - OpenAPI/AsyncAPI helpers, contract versioning
- **[@acme/web](./packages/web)** - HTTP adapters (Fastify/Nest) - opcional

### Testing
- **[@acme/testing](./packages/testing)** - Test builders, fakes, contract test helpers

## 🚀 Quick Start

```bash
# Instalar dependências
pnpm install

# Build todos os pacotes
pnpm build

# Rodar testes
pnpm test

# Lint
pnpm lint
```

## 📖 Uso em Microserviços

```typescript
// Importar apenas o que precisa
import { AggregateRoot, DomainEvent, Result } from '@acme/kernel';
import { CommandHandler } from '@acme/application';
import { Logger } from '@acme/observability';
import { OutboxPublisher } from '@acme/outbox';
```

## 📚 Documentação

### 🚀 Começando
- **[QUICKSTART.md](./QUICKSTART.md)** – ⚡ Comece aqui! Instalação e primeiros passos
- **[COMMANDS.md](./COMMANDS.md)** – 🛠️ Todos os comandos úteis (build, test, publish)

### 🤝 Contribuindo
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** – Guia de contribuição
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** – Visão geral do projeto

### 📖 Documentação Técnica
- **[docs/ADR.md](./docs/ADR.md)** – Architecture Decision Records
- **[docs/MIGRATION_GUIDE.md](./docs/MIGRATION_GUIDE.md)** – Migrar microserviços existentes
- **[examples/order-example.ts](./examples/order-example.ts)** – Exemplo completo funcional

### 📦 READMEs dos Pacotes
- [packages/kernel/README.md](./packages/kernel/README.md) – Core de domínio
- [packages/application/README.md](./packages/application/README.md) – CQRS & casos de uso
- [packages/errors/README.md](./packages/errors/README.md) – Gestão de erros
- [packages/config/README.md](./packages/config/README.md) – Configuração 12-factor
- [packages/resilience/README.md](./packages/resilience/README.md) – Tolerância a falhas

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────┐
│            Application Layer                    │
│  (Use Cases, Commands, Queries, Handlers)       │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│              Domain Layer (Kernel)               │
│  (Entities, Aggregates, Value Objects, Events)  │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│         Infrastructure Adapters                  │
│  (Web, Messaging, Persistence, Observability)   │
└──────────────────────────────────────────────────┘
```

## 🧪 Testing Strategy

- **Unit tests**: Lógica de domínio pura (kernel)
- **Integration tests**: Adapters + infra real
- **Contract tests**: APIs entre serviços
- **E2E tests**: Fluxos completos

## 📐 Convenções

- Cada pacote exporta apenas por `src/index.ts`
- Proibido imports internos: `@acme/kernel/src/ddd/Entity` ❌
- Use barrel exports: `@acme/kernel` ✅

## 📝 License

MIT
