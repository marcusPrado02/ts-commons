# @acme/messaging

**Event Messaging** - Event envelopes, publisher/subscriber interfaces, and pub/sub routing patterns.

## Installation

```
pnpm add @acme/messaging
```

## Key Exports

| Export                            | Kind    | Description                                    |
| --------------------------------- | ------- | ---------------------------------------------- |
| `EventName`, `EventVersion`       | values  | Envelope primitives for event type and version |
| `EventEnvelope`                   | type    | Wire format for all events                     |
| `EventPublisherPort`              | type    | Abstract publish interface                     |
| `EventHandler`, `EventConsumer`   | types   | Subscriber interfaces                          |
| `TopicRouter`                     | class   | Routes envelopes by event type string          |
| `ContentRouter`                   | class   | Routes by payload content predicate            |
| `FanOutBroker`                    | class   | Delivers every event to all subscribers        |
| `RequestReplyBroker`              | class   | Request/response over events                   |
| `MessageFilter`, `FilteredRouter` | classes | Filter-based routing                           |

## Usage

### Publishing events with TopicRouter

```typescript
import { TopicRouter, EventEnvelope, EventName } from '@acme/messaging';

const router = new TopicRouter();

router.subscribe('order.created', async (envelope: EventEnvelope) => {
  console.log('Order created:', envelope.payload);
});

const envelope: EventEnvelope = {
  id: '01HX...',
  name: EventName.of('order.created'),
  version: 1,
  occurredAt: new Date(),
  payload: { orderId: 'abc-123', customerId: 'cust-7' },
};

await router.route(envelope);
```

### Fan-out to all subscribers

```typescript
import { FanOutBroker, EventEnvelope } from '@acme/messaging';

const broker = new FanOutBroker();

broker.subscribe(async (envelope: EventEnvelope) => {
  await auditLog.record(envelope);
});

broker.subscribe(async (envelope: EventEnvelope) => {
  await metrics.increment(envelope.name.value);
});

await broker.publish(envelope); // both handlers receive the event
```

### Request/reply over events

```typescript
import { RequestReplyBroker, EventEnvelope } from '@acme/messaging';

const broker = new RequestReplyBroker();

broker.handle('user.lookup', async (envelope: EventEnvelope) => {
  const user = await userRepo.findById(envelope.payload.userId);
  return { user };
});

const reply = await broker.request({
  id: '01HY...',
  name: EventName.of('user.lookup'),
  version: 1,
  occurredAt: new Date(),
  payload: { userId: 'u-42' },
});

console.log(reply.payload.user);
```

## Dependencies

- `@acme/kernel` - domain primitives and identity types
