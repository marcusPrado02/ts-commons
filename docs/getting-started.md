# Getting Started

This guide walks you through installing ts-commons, building the monorepo, and writing your first DDD aggregate using `@acme/kernel`.

---

## Prerequisites

| Tool       | Minimum Version                      |
| ---------- | ------------------------------------ |
| Node.js    | 20 LTS                               |
| pnpm       | 8                                    |
| TypeScript | 5.3 (included via `devDependencies`) |

---

## Installation

```bash
# Clone the repository
git clone https://github.com/marcusPrado02/ts-commons.git
cd ts-commons

# Install all workspace dependencies
pnpm install
```

---

## Building

```bash
# Build all packages in dependency order
pnpm build

# Build a specific package only
pnpm --filter @acme/kernel build

# Watch mode (rebuild on change)
pnpm --filter @acme/kernel build:watch
```

---

## Running Tests

```bash
# All packages
pnpm test

# Single package
pnpm --filter @acme/kernel test

# Watch mode
pnpm --filter @acme/kernel test:watch

# With coverage
pnpm --filter @acme/kernel test:coverage
```

---

## Linting & Formatting

```bash
pnpm lint          # ESLint across all packages
pnpm lint:fix      # Auto-fix fixable issues
pnpm format        # Prettier format
pnpm typecheck     # tsc --noEmit across all packages
```

---

## Using a Package in Your Service

Install one or more packages from the monorepo (once published to npm):

```bash
# In your microservice
npm install @acme/kernel @acme/application @acme/persistence
```

Or, inside the monorepo workspace:

```bash
pnpm --filter my-service add @acme/kernel
```

---

## Your First Domain Aggregate

```typescript
import { AggregateRoot, ValueObject, DomainEvent, Result, UUID } from '@acme/kernel';

// 1. Value Object
interface MoneyProps {
  amount: number;
  currency: string;
}

class Money extends ValueObject<MoneyProps> {
  static create(amount: number, currency: string): Result<Money, Error> {
    if (amount < 0) return Result.err(new Error('Amount must be non-negative'));
    return Result.ok(new Money({ amount, currency }));
  }
  get amount() {
    return this.props.amount;
  }
  get currency() {
    return this.props.currency;
  }
}

// 2. Domain Event
class OrderPlacedEvent extends DomainEvent {
  constructor(public readonly orderId: string) {
    super({ aggregateId: orderId });
  }
}

// 3. Aggregate Root
class Order extends AggregateRoot<string> {
  private _total: Money;

  private constructor(id: string, total: Money) {
    super(id);
    this._total = total;
  }

  static place(id: string, amount: number): Result<Order, Error> {
    const totalResult = Money.create(amount, 'BRL');
    if (totalResult.isErr()) return Result.err(totalResult.unwrapErr());

    const order = new Order(id, totalResult.unwrap());
    order.addDomainEvent(new OrderPlacedEvent(id));
    return Result.ok(order);
  }

  get total(): Money {
    return this._total;
  }
}

// 4. Usage
const result = Order.place(UUID.generate(), 150);

result.match({
  ok: (order) => console.log('Order placed:', order.id),
  err: (error) => console.error('Failed:', error.message),
});
```

---

## Recommended Microservice Structure

```
my-service/
├── src/
│   ├── domain/                  # Pure DDD — @acme/kernel only
│   │   ├── Order.ts             # AggregateRoot
│   │   ├── Money.ts             # ValueObject
│   │   └── events/
│   │       └── OrderPlacedEvent.ts
│   │
│   ├── application/             # Use Cases — @acme/application
│   │   └── usecases/
│   │       └── PlaceOrderUseCase.ts
│   │
│   ├── infrastructure/          # Adapters — @acme/persistence-*, messaging-*, etc.
│   │   ├── persistence/
│   │   └── messaging/
│   │
│   └── transport/               # HTTP — @acme/web-fastify or @acme/web-nestjs
│       └── OrderController.ts
│
├── test/
├── package.json
└── tsconfig.json
```

---

## Next Steps

| Topic                        | Document                                                                    |
| ---------------------------- | --------------------------------------------------------------------------- |
| Architecture principles      | [docs/architecture.md](architecture.md)                                     |
| DDD primitives               | [docs/packages/kernel.md](packages/kernel.md)                               |
| Use Cases & CQRS             | [docs/packages/application.md](packages/application.md)                     |
| Complete service walkthrough | [docs/guides/building-a-microservice.md](guides/building-a-microservice.md) |
