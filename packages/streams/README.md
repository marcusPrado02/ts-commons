# @acme/streams

Reactive stream processing primitives: `EventStream`, backpressure queues, stream merging, and time-window aggregation. Designed for high-throughput in-process event pipelines.

## Installation

```bash
pnpm add @acme/streams
```

## Quick Start

```typescript
import { EventStream } from '@acme/streams';

const stream = new EventStream<OrderEvent>();

// Subscribe
const sub = stream.subscribe({
  next: (event) => processEvent(event),
  error: (err) => logger.error(err),
  complete: () => logger.info('Stream closed'),
});

// Publish
stream.emit({ type: 'ORDER_CREATED', orderId: 'ord-123' });
stream.emit({ type: 'ORDER_SHIPPED', orderId: 'ord-123' });

// Unsubscribe
sub.unsubscribe();
```

## Backpressure

```typescript
import { BackpressureQueue } from '@acme/streams';

const queue = new BackpressureQueue<OrderEvent>({
  maxSize: 1000,
  strategy: 'DROP_OLDEST', // or 'DROP_NEWEST' | 'BLOCK'
});

await queue.enqueue(event);
const next = await queue.dequeue();
```

## Windowed Aggregation

```typescript
import { WindowStrategy } from '@acme/streams';

const window = new WindowStrategy<OrderEvent>({
  type: 'tumbling',
  sizeMs: 5_000, // 5-second tumbling window
});

window.onFlush((batch) => {
  const totalRevenue = batch.reduce((sum, e) => sum + e.amount, 0);
  metrics.gauge('revenue.5s').set(totalRevenue);
});
```

## Stream Merging

```typescript
import { StreamMerger } from '@acme/streams';

const merged = StreamMerger.merge([ordersStream, paymentsStream]);
merged.subscribe({ next: (event) => router.dispatch(event) });
```

## See Also

- [`@acme/messaging`](../messaging) — broker-backed event publishing
- [`@acme/data-pipeline`](../data-pipeline) — ETL framework
