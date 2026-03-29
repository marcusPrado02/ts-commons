# @marcusprado02/eventsourcing

Event sourcing building blocks: event store, `EventSourcedAggregate`, snapshots, projections, and event replay. Implements the full CQRS + event sourcing stack.

## Installation

```bash
pnpm add @marcusprado02/eventsourcing
```

## Quick Start

```typescript
import { EventSourcedAggregate, InMemoryEventStore } from '@marcusprado02/eventsourcing';
import type { EventStore } from '@marcusprado02/eventsourcing';

// Define a domain event
class OrderCreated {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
  ) {}
}

// Aggregate that sources its state from events
class Order extends EventSourcedAggregate {
  status: string = 'pending';

  apply(event: unknown): void {
    if (event instanceof OrderCreated) {
      this.status = 'pending';
    }
  }

  create(userId: string) {
    this.raise(new OrderCreated(this.id, userId));
  }
}

// Persist and rehydrate
const store: EventStore = new InMemoryEventStore();
const order = new Order('order-123');
order.create('user-456');
await store.append(order.id, order.getUncommittedEvents(), order.version);

const events = await store.load(order.id);
const rehydrated = Order.rehydrate('order-123', events);
```

## Projections

```typescript
import { ProjectionRunner } from '@marcusprado02/eventsourcing';

const runner = new ProjectionRunner(store);
runner.register('orders-read-model', {
  $init: () => ({ orders: [] }),
  OrderCreated: (state, event) => ({ orders: [...state.orders, event.orderId] }),
});
await runner.run('orders-read-model');
```

## Snapshots

```typescript
import { InMemorySnapshotStore } from '@marcusprado02/eventsourcing';

const snapshots = new InMemorySnapshotStore();
await snapshots.save({ aggregateId: 'order-123', version: 100, state: order.toSnapshot() });
```

## See Also

- [`@marcusprado02/outbox`](../outbox) — transactional delivery of domain events
- [`@marcusprado02/schema-registry`](../schema-registry) — schema versioning for events
