# @marcusprado02/application

**Application Layer** - Use cases, CQRS, validação, idempotência e transações.

## Features

- 📋 **CQRS**: Command/Query separation com buses
- 🎯 **Use Cases**: Orchestração de lógica de aplicação
- ✅ **Validation**: Validação de entrada
- 🔑 **Idempotency**: Suporte a operações idempotentes
- 🔄 **Transactions**: Unit of Work pattern

## Uso

```typescript
import { CommandHandler, Command, Result } from '@marcusprado02/application';
import { DomainError } from '@marcusprado02/kernel';

class CreateOrderCommand implements Command {
  constructor(public readonly customerId: string) {}
}

class CreateOrderHandler implements CommandHandler<CreateOrderCommand, string> {
  async handle(command: CreateOrderCommand): Promise<Result<string, DomainError>> {
    // Use case logic
    return Result.ok('order-123');
  }
}
```
