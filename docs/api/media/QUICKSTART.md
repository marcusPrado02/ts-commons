# 🚀 Quick Start Guide - ts-commons

## ✅ Biblioteca Criada Com Sucesso!

Você tem agora uma **biblioteca TypeScript enterprise-grade** com **100 arquivos TypeScript** organizados em **13 pacotes** seguindo os princípios de **Clean Architecture**, **DDD**, **Hexagonal Architecture**, e **CQRS**.

---

## 📦 Pacotes Criados

| Pacote | Descrição | Dependencies |
|--------|-----------|--------------|
| `@acme/kernel` | DDD core (Entity, ValueObject, DomainEvent) | **ZERO** ✅ |
| `@acme/application` | Use Cases, CQRS, Validation | kernel |
| `@acme/errors` | Problem Details, HTTP errors | kernel |
| `@acme/config` | 12-factor config loader | kernel |
| `@acme/observability` | Logging, Metrics, Tracing | kernel |
| `@acme/resilience` | Retry, Timeout, Circuit Breaker | kernel |
| `@acme/security` | AuthN/AuthZ, Crypto, PII | kernel |
| `@acme/messaging` | Event envelopes, Pub/Sub | kernel |
| `@acme/outbox` | Transactional outbox/inbox | kernel, messaging |
| `@acme/persistence` | Repository, Pagination | kernel |
| `@acme/contracts` | API contracts, Versioning | kernel |
| `@acme/web` | HTTP adapters, Middlewares | kernel, errors, contracts |
| `@acme/testing` | Test fakes, Builders | kernel, application, outbox |

---

## 🎯 Próximos Passos

### 1️⃣ Instalar Dependências

```bash
cd /home/maps/2026/ts-commons
pnpm install
```

### 2️⃣ Build Todos os Pacotes

```bash
# Opção 1: Usando pnpm
pnpm build

# Opção 2: Usando script customizado
./scripts/build-all.sh
```

### 3️⃣ Rodar Testes (quando implementados)

```bash
pnpm test
```

### 4️⃣ Publicar Pacotes (quando pronto)

```bash
# 1. Login no npm registry
npm login

# 2. Build tudo
pnpm build

# 3. Publicar todos os pacotes
pnpm -r publish --access public
```

---

## 💡 Como Usar em um Microserviço

### Setup Inicial

```bash
# No seu microserviço
pnpm add @acme/kernel @acme/application @acme/errors @acme/observability
```

### Exemplo: Order Service

```typescript
// domain/Order.ts
import { AggregateRoot, DomainEvent, ValueObject, Result } from '@acme/kernel';

class OrderId extends ValueObject<string> {
  static create(): OrderId {
    return new OrderId(crypto.randomUUID());
  }
}

class OrderCreated extends DomainEvent {
  constructor(public readonly orderId: string) {
    super();
  }
}

class Order extends AggregateRoot<OrderId> {
  private constructor(
    id: OrderId,
    private customerId: string,
  ) {
    super(id);
  }

  static create(customerId: string): Result<Order, Error> {
    if (!customerId) {
      return Result.err(new Error('Customer ID required'));
    }

    const order = new Order(OrderId.create(), customerId);
    order.record(new OrderCreated(order.id.value));
    return Result.ok(order);
  }
}
```

```typescript
// application/CreateOrderHandler.ts
import { Command, CommandHandler } from '@acme/application';
import { Logger } from '@acme/observability';

class CreateOrderCommand implements Command {
  constructor(public readonly customerId: string) {}
}

class CreateOrderHandler implements CommandHandler<CreateOrderCommand, string> {
  constructor(private logger: Logger) {}

  async handle(cmd: CreateOrderCommand) {
    this.logger.info('Creating order', { customerId: cmd.customerId });

    const orderResult = Order.create(cmd.customerId);
    if (orderResult.isErr()) {
      return orderResult;
    }

    const order = orderResult.unwrap();
    
    // Save to DB, publish events, etc.
    
    return Result.ok(order.id.value);
  }
}
```

```typescript
// infrastructure/http/server.ts
import { correlationMiddleware } from '@acme/web';
import { HttpErrorMapper } from '@acme/errors';

app.post('/orders', async (req, res) => {
  try {
    const handler = new CreateOrderHandler(logger);
    const result = await handler.handle(
      new CreateOrderCommand(req.body.customerId)
    );

    if (result.isErr()) {
      const problem = HttpErrorMapper.toProblemDetails(result.unwrapErr());
      return res.status(problem.status).json(problem);
    }

    res.status(201).json({ orderId: result.unwrap() });
  } catch (error) {
    const problem = HttpErrorMapper.toProblemDetails(error);
    res.status(problem.status).json(problem);
  }
});
```

---

## 📚 Documentação

- **[README.md](./README.md)** - Overview da biblioteca
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Guia de contribuição
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - Resumo completo do projeto
- **[docs/ADR.md](./docs/ADR.md)** - Architecture Decision Records
- **[docs/MIGRATION_GUIDE.md](./docs/MIGRATION_GUIDE.md)** - Como migrar apps existentes
- **[examples/order-example.ts](./examples/order-example.ts)** - Exemplo completo

### READMEs dos Pacotes

- [packages/kernel/README.md](./packages/kernel/README.md)
- [packages/application/README.md](./packages/application/README.md)
- [packages/errors/README.md](./packages/errors/README.md)
- [packages/config/README.md](./packages/config/README.md)
- [packages/resilience/README.md](./packages/resilience/README.md)

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│    (HTTP/gRPC/GraphQL endpoints)        │
│         [@acme/web]                     │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│       Application Layer                 │
│  (Use Cases, Commands, Queries)         │
│   [@acme/application]                   │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│         Domain Layer                    │
│  (Entities, Aggregates, Events)         │
│        [@acme/kernel]                   │
│     ZERO framework dependencies         │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│     Infrastructure Layer                │
│  (DB, Message Broker, External APIs)    │
│  [@acme/persistence, @acme/messaging]   │
└─────────────────────────────────────────┘
```

---

## ✨ Próximas Melhorias Sugeridas

### Curto Prazo
- [ ] Adicionar testes unitários para cada pacote
- [ ] Configurar GitHub Actions para CI/CD
- [ ] Adicionar exemplos de integração (Fastify, Prisma, etc.)
- [ ] Criar CLI tool para scaffolding (`create-acme-service`)

### Médio Prazo
- [ ] Implementar adapters concretos (Prisma, TypeORM, etc.)
- [ ] Adicionar OpenTelemetry integration
- [ ] Criar Docker examples
- [ ] Adicionar metrics exporters (Prometheus)

### Longo Prazo
- [ ] Monorepo template completo
- [ ] Event Sourcing support
- [ ] SAGA orchestration
- [ ] Kubernetes deployment examples

---

## 🎉 Parabéns!

Você criou uma biblioteca TypeScript de nível enterprise que pode ser usada em **múltiplos microserviços**, promovendo:

✅ **Reuso de código**  
✅ **Padrões consistentes**  
✅ **Arquitetura limpa**  
✅ **Type safety**  
✅ **Testabilidade**  
✅ **Manutenibilidade**  

**Happy coding! 🚀**
