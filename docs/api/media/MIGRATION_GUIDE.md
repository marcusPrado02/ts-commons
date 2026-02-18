# Migração de Microserviço Existente para ts-commons

## Cenário
Você tem um microserviço Node.js/TypeScript existente e quer adotar os padrões da ts-commons.

## Estratégia de Migração Incremental

### Fase 1: Instalação (Semana 1)

```bash
pnpm add @acme/kernel @acme/errors @acme/config @acme/observability
```

**Ações:**
1. Substituir classes de erro customizadas por `@acme/errors`
2. Migrar configuração para `@acme/config` (12-factor)
3. Padronizar logging com `@acme/observability`

### Fase 2: Domain Layer (Semanas 2-3)

```bash
pnpm add @acme/kernel
```

**Ações:**
1. Identificar entidades de domínio existentes
2. Migrar para `Entity` ou `AggregateRoot` de `@acme/kernel`
3. Extrair Value Objects
4. Introduzir Domain Events

**Antes:**
```typescript
class Order {
  id: string;
  customerId: string;
  total: number;
}
```

**Depois:**
```typescript
import { AggregateRoot, ValueObject } from '@acme/kernel';

class OrderId extends ValueObject<string> {}
class Money extends ValueObject<number> {}

class Order extends AggregateRoot<OrderId> {
  constructor(
    id: OrderId,
    private customerId: string,
    private total: Money,
  ) {
    super(id);
  }
}
```

### Fase 3: Application Layer (Semana 4)

```bash
pnpm add @acme/application
```

**Ações:**
1. Extrair lógica de negócio de controllers para Use Cases
2. Implementar CQRS com `Command` e `Query`
3. Adicionar validação com `Validator`

**Antes:**
```typescript
// No controller
app.post('/orders', async (req, res) => {
  const order = await db.orders.create(req.body);
  res.json(order);
});
```

**Depois:**
```typescript
// Command Handler
class CreateOrderHandler implements CommandHandler<CreateOrderCommand, string> {
  async handle(command: CreateOrderCommand) {
    // Lógica isolada, testável
  }
}

// Controller só delega
app.post('/orders', async (req, res) => {
  const result = await commandBus.dispatch(new CreateOrderCommand(req.body));
  res.json(result);
});
```

### Fase 4: Infraestrutura (Semanas 5-6)

```bash
pnpm add @acme/resilience @acme/outbox @acme/persistence
```

**Ações:**
1. Adicionar Retry e Circuit Breaker em chamadas externas
2. Implementar Outbox Pattern para eventos
3. Abstrair repositories com `RepositoryPort`

### Fase 5: Observabilidade & Segurança (Semana 7)

```bash
pnpm add @acme/security @acme/contracts
```

**Ações:**
1. Adicionar correlation ID em todas as requisições
2. Implementar AuthN/AuthZ com `@acme/security`
3. Versionamento de API com `@acme/contracts`

## Checklist de Migração

- [ ] Instalar pacotes core (`kernel`, `errors`, `config`)
- [ ] Migrar logging para `@acme/observability`
- [ ] Migrar entidades para DDD (`Entity`, `AggregateRoot`)
- [ ] Extrair Value Objects
- [ ] Implementar Domain Events
- [ ] Criar Command/Query Handlers
- [ ] Implementar CQRS Bus
- [ ] Adicionar Outbox Pattern
- [ ] Abstrair Repositories
- [ ] Adicionar Resilience patterns
- [ ] Implementar correlation/tracing
- [ ] Configurar CI/CD
- [ ] Documentar API com OpenAPI

## Métricas de Sucesso

- ✅ Separação clara entre Domain/Application/Infrastructure
- ✅ Alto code coverage (>80%)
- ✅ Tempo de resposta P95 < 200ms
- ✅ Zero vazamento de framework no domínio
- ✅ Logs estruturados com correlation ID
- ✅ APIs versionadas e documentadas
