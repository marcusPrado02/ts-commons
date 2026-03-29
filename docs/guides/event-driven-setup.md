# Event-Driven Architecture Setup Guide

This guide covers how to wire `@marcusprado02/messaging`, `@marcusprado02/eventsourcing`, and `@marcusprado02/outbox` into a service.

---

## Core concepts

| Package                        | Role                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `@marcusprado02/messaging`     | Event envelopes, publisher port, pub/sub routing (`FanOutBroker`, `TopicRouter`) |
| `@marcusprado02/eventsourcing` | Event-sourced aggregates, event store, projections                               |
| `@marcusprado02/outbox`        | Transactional outbox/inbox — at-least-once delivery guarantee                    |

---

## Publishing events

### Define an event envelope

```typescript
import type { EventEnvelope } from '@marcusprado02/messaging';
import { EventName, EventVersion } from '@marcusprado02/messaging';

// 1. Define the payload shape
interface OrderConfirmedPayload {
  orderId: string;
  customerId: string;
  totalCents: number;
}

// 2. Build an envelope (the wire format)
const envelope: EventEnvelope<OrderConfirmedPayload> = {
  id: crypto.randomUUID(),
  type: EventName.of('order.confirmed'),
  version: EventVersion.of(1),
  timestamp: new Date().toISOString(),
  correlationId: requestId,
  payload: { orderId: 'ord-1', customerId: 'cust-42', totalCents: 4999 },
};
```

### Implement a publisher adapter

`EventPublisherPort` is the abstraction; swap implementations without changing callers.

```typescript
import type { EventPublisherPort, EventEnvelope } from '@marcusprado02/messaging';

// In-memory (tests, demos)
class ConsoleEventPublisher implements EventPublisherPort {
  async publish<T>(envelope: EventEnvelope<T>): Promise<void> {
    console.log('[event]', envelope.type, envelope.payload);
  }
}

// Production: inject a Kafka/RabbitMQ/EventBridge adapter
```

---

## Pub/Sub routing

### FanOutBroker (in-process, all subscribers receive every event)

```typescript
import { FanOutBroker } from '@marcusprado02/messaging';
import type { EventEnvelope } from '@marcusprado02/messaging';

const broker = new FanOutBroker();

// Subscribe
broker.addSubscriber('email-handler', (env: EventEnvelope<unknown>) => {
  console.log('Email handler received', env.type);
});

broker.addSubscriber('audit-handler', (env: EventEnvelope<unknown>) => {
  console.log('Audit handler received', env.type);
});

// Publish — both subscribers are called
await broker.publish(envelope);

// Unsubscribe when no longer needed
broker.removeSubscriber('email-handler');
```

### TopicRouter (filter by event type)

```typescript
import { TopicRouter } from '@marcusprado02/messaging';

const router = new TopicRouter();

router.subscribe('order.confirmed', async (env) => {
  // Only called for order.confirmed events
  await sendConfirmationEmail(env.payload);
});

router.subscribe('order.cancelled', async (env) => {
  await sendCancellationEmail(env.payload);
});

// Route an incoming envelope to the correct handler
await router.route(envelope);
```

### ContentRouter (filter by payload content)

```typescript
import { ContentRouter } from '@marcusprado02/messaging';

const router = new ContentRouter<{ region: string }>();

router.subscribe(
  (payload) => payload.region === 'EU',
  async (env) => {
    // Handle EU events only
    await processGdprCompliant(env);
  },
);
```

---

## Event Sourcing

### Define an event-sourced aggregate

```typescript
import { EventSourcedAggregate } from '@marcusprado02/eventsourcing';
import type { DomainEvent } from '@marcusprado02/kernel';

class AccountOpened implements DomainEvent {
  readonly occurredAt = new Date();
  constructor(
    readonly accountId: string,
    readonly owner: string,
  ) {}
}

class BankAccount extends EventSourcedAggregate<string> {
  private _owner = '';

  private constructor(id: string) {
    super(id);
  }

  static open(accountId: string, owner: string): BankAccount {
    const acc = new BankAccount(accountId);
    acc.raise(new AccountOpened(accountId, owner)); // raise() = record + apply
    return acc;
  }

  protected apply(event: DomainEvent): void {
    if (event instanceof AccountOpened) this._owner = event.owner;
  }

  get owner() {
    return this._owner;
  }
}
```

### Persist and reload via EventStore

```typescript
import { InMemoryEventStore } from '@marcusprado02/eventsourcing';

const store = new InMemoryEventStore();

// Save (append-only, optimistic concurrency)
const account = BankAccount.open('acc-1', 'Alice');
const uncommitted = [...account.getUncommittedEvents()];
await store.append('acc-1', uncommitted, 0); // 0 = expected version (new stream)
account.markCommitted();

// Reload (replay events from store)
const history = await store.getEvents('acc-1');
const reloaded = BankAccount.loadFromHistory(history);
```

### Build read-model projections

```typescript
import { ProjectionRunner } from '@marcusprado02/eventsourcing';
import type { Projection } from '@marcusprado02/eventsourcing';

interface AccountView {
  owner: string;
  eventCount: number;
}

class AccountViewProjection implements Projection<AccountView> {
  state: AccountView = { owner: '', eventCount: 0 };

  apply(event: DomainEvent): void {
    this.state.eventCount++;
    if (event instanceof AccountOpened) this.state.owner = event.owner;
  }
}

const runner = new ProjectionRunner(new AccountViewProjection());
const view = runner.run(history);
// view.owner === 'Alice', view.eventCount === 1
```

---

## Transactional Outbox

The outbox pattern guarantees at-least-once delivery: messages are saved in the same database transaction as your domain state, then relayed to the broker asynchronously.

```typescript
import { InMemoryOutboxStore, InMemoryInboxStore, OutboxRelay } from '@marcusprado02/outbox';
import type { OutboxMessage } from '@marcusprado02/outbox';

// 1. Setup stores
const outboxStore = new InMemoryOutboxStore();
const inboxStore = new InMemoryInboxStore();

// 2. In your command handler — write to outbox atomically with domain state
async function handleCreateOrder(cmd: CreateOrderCommand): Promise<void> {
  const order = Order.create(cmd);
  await orderRepo.save(order);

  // Write outbox message in the same "transaction"
  const msg: OutboxMessage = {
    id: crypto.randomUUID(),
    type: 'order.created',
    payload: JSON.stringify({ orderId: order.id }),
    createdAt: new Date(),
  };
  await outboxStore.save(msg);
}

// 3. Relay loop — runs in background, publishes pending messages
const relay = new OutboxRelay(outboxStore, publisher, {
  pollingIntervalMs: 1000,
  batchSize: 50,
});
relay.start();

// 4. On shutdown
relay.stop();
```

### Inbox (idempotent processing)

```typescript
import { InMemoryInboxStore } from '@marcusprado02/outbox';
import type { InboxMessage } from '@marcusprado02/outbox';

const inbox = new InMemoryInboxStore();

async function handleEvent(envelope: EventEnvelope<unknown>): Promise<void> {
  // Skip duplicates
  if (await inbox.exists(envelope.id)) return;

  // Process ...
  await processOrder(envelope.payload);

  // Mark as processed
  const msg: InboxMessage = {
    id: envelope.id,
    type: envelope.type.value,
    processedAt: new Date(),
  };
  await inbox.save(msg);
}
```

---

## Putting it together

```
Command handler
  → writes domain state + OutboxMessage (atomic)

OutboxRelay (background)
  → polls OutboxStore
  → publishes EventEnvelope via EventPublisherPort
  → marks message as sent

Subscribers (FanOutBroker / TopicRouter)
  → receive EventEnvelope
  → call EventHandler.handle()
  → write to InboxStore (idempotency)
  → update read-model / trigger side-effects
```

For production, replace `InMemoryOutboxStore` with a database-backed implementation that participates in your real transactions.
