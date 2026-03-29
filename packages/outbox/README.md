# @marcusprado02/outbox

Transactional Outbox/Inbox pattern. Guarantees at-least-once event delivery by persisting messages in the same database transaction as the domain change, then relaying them via a background worker.

## Installation

```bash
pnpm add @marcusprado02/outbox
```

## Quick Start

```typescript
import { OutboxRelay, InMemoryOutboxStore } from '@marcusprado02/outbox';
import type { OutboxMessage } from '@marcusprado02/outbox';

const store = new InMemoryOutboxStore();

// Write to outbox inside your database transaction
await db.transaction(async (tx) => {
  await orderRepo.save(order, tx);
  await store.append({
    aggregateId: order.id,
    eventType: 'OrderCreated',
    payload: order.toJSON(),
  });
});

// Background relay picks up unpublished messages and delivers them
const relay = new OutboxRelay(store, eventPublisher, {
  pollIntervalMs: 1_000,
  batchSize: 50,
});
relay.start();
```

## Inbox (Idempotent Consumers)

```typescript
import { InMemoryInboxStore } from '@marcusprado02/outbox';
import type { InboxMessage } from '@marcusprado02/outbox';

const inbox = new InMemoryInboxStore();

// Check and mark before processing to guarantee exactly-once
const alreadyProcessed = await inbox.isProcessed(messageId);
if (!alreadyProcessed) {
  await processEvent(event);
  await inbox.markProcessed(messageId);
}
```

## See Also

- [`@marcusprado02/messaging`](../messaging) — event publisher port
- [`@marcusprado02/saga`](../saga) — saga choreography uses the outbox pattern
- [`@marcusprado02/eventsourcing`](../eventsourcing) — event store
