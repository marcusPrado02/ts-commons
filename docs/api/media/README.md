# @acme/kernel

**DDD Kernel** - Núcleo de Domain-Driven Design com **zero dependências de framework**.

## Features

- 🏛️ **DDD Building Blocks**: Entity, AggregateRoot, ValueObject, DomainEvent
- 🆔 **Identity Types**: TenantId, CorrelationId, CausationId, ULID, UUID
- 🔄 **Functional Primitives**: Result, Option, Either
- ⏰ **Time Abstractions**: Clock, Instant, Duration
- ❌ **Domain Errors**: DomainError, InvariantViolation, NotFound, Conflict
- 🔌 **Ports**: Logger, Tracer, Metrics (interfaces apenas)

## Uso

```typescript
import { 
  AggregateRoot, 
  DomainEvent, 
  ValueObject, 
  Result, 
  UUID 
} from '@acme/kernel';

class OrderId extends ValueObject<string> {}

class OrderCreated extends DomainEvent {
  constructor(public readonly orderId: string) {
    super();
  }
}

class Order extends AggregateRoot<OrderId> {
  static create(customerId: string): Result<Order, DomainError> {
    const order = new Order(new OrderId(UUID.generate()));
    order.record(new OrderCreated(order.id.value));
    return Result.ok(order);
  }
}
```

## Princípios

- ✅ **Zero framework dependencies** - Apenas TypeScript puro
- ✅ **Immutability** - ValueObjects são imutáveis
- ✅ **Domain events** - Comunicação entre aggregates
- ✅ **Invariant protection** - Validações no domínio
