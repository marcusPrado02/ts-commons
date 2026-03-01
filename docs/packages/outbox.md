# @acme/outbox

Transactional Outbox pattern: events are persisted atomically with your domain data before being published to the message broker. Guarantees **at-least-once delivery** with no dual-write problems.

**Install:** `pnpm add @acme/outbox @acme/kernel @acme/messaging`

---

## How It Works

```
1. UseCase runs (inside UnitOfWork transaction)
   ├─ Save aggregate to DB
   └─ Save domain events to outbox table (same transaction)

2. OutboxRelay polls outbox table on a timer
   ├─ Reads PENDING entries in batches
   ├─ Publishes each to the message broker
   └─ Marks as DELIVERED (or FAILED after retries)
```

If the broker is down, events accumulate in the outbox and are delivered once it recovers. No event is ever lost.

---

## `OutboxStorePort` — Port

```typescript
import type { OutboxStorePort } from '@acme/outbox';

// Implement using your DB of choice (see adapters in persistence-prisma / persistence-mongodb)
export interface OutboxStorePort {
  save(entry: OutboxEntry): Promise<void>;
  findPending(limit: number): Promise<OutboxEntry[]>;
  markDelivered(id: string): Promise<void>;
  markFailed(id: string, reason: string): Promise<void>;
}
```

---

## Writing to the Outbox (in a Use Case)

```typescript
import { OutboxStorePort } from '@acme/outbox';
import { UUID } from '@acme/kernel';

export class PlaceOrderUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly orderRepo: OrderRepository,
    private readonly outboxStore: OutboxStorePort,
  ) {}

  async execute(input: PlaceOrderInput) {
    return this.uow.run(async () => {
      const order = Order.place(id, items).unwrap();
      await this.orderRepo.save(order);

      // Save events to outbox atomically (same transaction as the order save)
      for (const event of order.pullDomainEvents()) {
        await this.outboxStore.save({
          id: UUID.generate(),
          aggregateId: order.id.value,
          eventType: event.constructor.name,
          payload: JSON.stringify(event),
          createdAt: new Date(),
          status: 'PENDING',
        });
      }

      return Result.ok({ orderId: order.id.value });
    });
  }
}
```

---

## `OutboxRelay` — Background Publisher

```typescript
import { OutboxRelay } from '@acme/outbox';

const relay = new OutboxRelay(outboxStore, publisher, {
  pollingIntervalMs: 5_000, // poll every 5 seconds
  batchSize: 50, // process up to 50 events per poll cycle
  maxRetries: 3, // retry failed events up to 3 times
  retryDelayMs: 1_000, // wait 1 second between retries
});

await relay.start();

// Always stop on shutdown
shutdown.register('outbox-relay', () => relay.stop());
```

---

## `InMemoryOutboxStore` — For Tests

```typescript
import { InMemoryOutboxStore } from '@acme/outbox';

const outboxStore = new InMemoryOutboxStore();
const useCase = new PlaceOrderUseCase(uow, orderRepo, outboxStore);

await useCase.execute(validInput);

const events = outboxStore.getPending();
expect(events).toHaveLength(1);
expect(events[0]!.eventType).toBe('OrderPlacedEvent');
```

> See also `@acme/testing` which re-exports `InMemoryOutboxStore` alongside other test fakes.

---

## Outbox with Prisma

```typescript
import { PrismaOutboxStore } from '@acme/persistence-prisma';

const outboxStore = new PrismaOutboxStore(prisma);
// Uses the `outbox` Prisma model — see docs/guides/building-a-microservice.md
```

Required Prisma schema:

```prisma
model Outbox {
  id          String   @id
  aggregateId String
  eventType   String
  payload     String
  status      String   @default("PENDING")
  retries     Int      @default(0)
  createdAt   DateTime @default(now())
  processedAt DateTime?
  error       String?
}
```

---

## Summary

| Export                | Purpose                                                   |
| --------------------- | --------------------------------------------------------- |
| `OutboxStorePort`     | Port — store interface (save, findPending, markDelivered) |
| `OutboxEntry`         | Outbox record type                                        |
| `OutboxRelay`         | Background worker that publishes pending entries          |
| `InMemoryOutboxStore` | In-memory fake for tests                                  |
