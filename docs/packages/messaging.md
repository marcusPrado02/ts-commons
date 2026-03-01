# @acme/messaging

Event publishing and consuming abstraction. Define ports in your domain; swap broker adapters without changing business code.

**Core install:** `pnpm add @acme/messaging @acme/kernel`

**Adapter installs:**

- `pnpm add @acme/messaging-kafka`
- `pnpm add @acme/messaging-rabbitmq`
- `pnpm add @acme/messaging-eventbridge`

---

## `EventPublisherPort` and `EventEnvelope`

The port that domain/application code depends on:

```typescript
import { EventPublisherPort, EventEnvelope } from '@acme/messaging';

// Domain boundary — no broker details here
export interface OrderEventPublisher extends EventPublisherPort {
  publishOrderPlaced(event: OrderPlacedEvent): Promise<void>;
}
```

`EventEnvelope` wraps any domain event with standard metadata:

```typescript
const envelope = EventEnvelope.create(new OrderPlacedEvent(orderId, total));
// envelope.id            → UUID
// envelope.type          → "OrderPlacedEvent"
// envelope.payload       → the domain event
// envelope.occurredAt    → ISO timestamp
// envelope.correlationId → from CorrelationContext
// envelope.tenantId      → from TenantContext
```

---

## Kafka

### Publisher

```typescript
import { KafkaEventPublisher, KafkaConnection } from '@acme/messaging-kafka';

const kafka = new KafkaConnection({
  brokers: ['kafka:9092'],
  clientId: 'orders-service',
});

const publisher = new KafkaEventPublisher(kafka, {
  topic: 'orders.events',
  serializer: (envelope) => JSON.stringify(envelope),
});

await publisher.publish(EventEnvelope.create(new OrderPlacedEvent(orderId, total)));
```

### Consumer

```typescript
import { KafkaEventConsumer } from '@acme/messaging-kafka';

const consumer = new KafkaEventConsumer(kafka, {
  topics: ['orders.events'],
  groupId: 'payments-service',
});

consumer.subscribe(async (envelope) => {
  if (envelope.type === 'OrderPlacedEvent') {
    const event = envelope.payload as OrderPlacedEvent;
    await paymentService.charge(event.orderId, event.total);
  }
});

await consumer.start();
// Stop on shutdown:
shutdown.register('kafka-consumer', () => consumer.stop());
```

---

## RabbitMQ

```typescript
import {
  RabbitMQConnection,
  RabbitMQEventPublisher,
  RabbitMQEventConsumer,
} from '@acme/messaging-rabbitmq';

const connection = new RabbitMQConnection({ url: 'amqp://rabbitmq:5672' });

const publisher = new RabbitMQEventPublisher(connection, {
  exchange: 'orders',
  routingKey: (envelope) => envelope.type.toLowerCase(),
});

const consumer = new RabbitMQEventConsumer(connection, {
  queue: 'payments.orders',
  exchange: 'orders',
  routingKey: '#', // subscribe to all routing keys
});

consumer.subscribe(async (envelope) => {
  await processPaymentCommand(envelope);
});
```

---

## AWS EventBridge

```typescript
import { EventBridgeEventPublisher, EventBridgeConnection } from '@acme/messaging-eventbridge';

const bridge = new EventBridgeConnection({ region: 'us-east-1' });

const publisher = new EventBridgeEventPublisher(bridge, {
  eventBusName: 'orders-bus',
  source: 'orders-service',
});

await publisher.publish(EventEnvelope.create(new OrderPlacedEvent(orderId, total)));
```

---

## Message Routing Pattern

Decouple consumer logic with a simple dispatcher:

```typescript
import { EventEnvelope } from '@acme/messaging';

class OrderEventDispatcher {
  private readonly handlers = new Map<string, (env: EventEnvelope) => Promise<void>>();

  on(type: string, handler: (env: EventEnvelope) => Promise<void>): this {
    this.handlers.set(type, handler);
    return this;
  }

  async dispatch(envelope: EventEnvelope): Promise<void> {
    const handler = this.handlers.get(envelope.type);
    if (handler) await handler(envelope);
  }
}

const dispatcher = new OrderEventDispatcher()
  .on('OrderPlacedEvent', (e) => paymentService.charge(e.payload))
  .on('OrderCancelledEvent', (e) => inventoryService.release(e.payload));

consumer.subscribe((e) => dispatcher.dispatch(e));
```

---

## Summary

| Export                      | Package                 | Purpose                                      |
| --------------------------- | ----------------------- | -------------------------------------------- |
| `EventPublisherPort`        | `messaging`             | Port — domain interface for event publishing |
| `EventEnvelope`             | `messaging`             | Domain event wrapper with metadata           |
| `KafkaConnection`           | `messaging-kafka`       | Kafka client factory                         |
| `KafkaEventPublisher`       | `messaging-kafka`       | Kafka producer                               |
| `KafkaEventConsumer`        | `messaging-kafka`       | Kafka consumer group                         |
| `RabbitMQConnection`        | `messaging-rabbitmq`    | AMQP connection factory                      |
| `RabbitMQEventPublisher`    | `messaging-rabbitmq`    | RabbitMQ exchange publisher                  |
| `RabbitMQEventConsumer`     | `messaging-rabbitmq`    | RabbitMQ queue consumer                      |
| `EventBridgeEventPublisher` | `messaging-eventbridge` | AWS EventBridge publisher                    |
