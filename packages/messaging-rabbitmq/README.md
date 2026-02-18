# @acme/messaging-rabbitmq

RabbitMQ adapter for event-driven messaging with Clean Architecture principles.

## Features

- ✅ **Event Publishing**: `EventPublisherPort` implementation with correlation ID propagation
- ✅ **Event Consuming**: `EventConsumer` implementation with subscription pattern
- ✅ **Connection Pooling**: Efficient connection and channel management
- ✅ **Dead Letter Queue**: Automatic DLQ support for failed messages
- ✅ **Retry Mechanism**: Configurable exponential backoff retry
- ✅ **Message Deduplication**: Prevents duplicate message processing
- ✅ **Health Checks**: Connection status monitoring
- ✅ **Graceful Shutdown**: Clean resource cleanup
- ✅ **Type-Safe**: Full TypeScript support with strict mode

## Installation

```bash
pnpm add @acme/messaging-rabbitmq
```

## Quick Start

### 1. Create Connection

```typescript
import { RabbitMQConnection } from '@acme/messaging-rabbitmq';
import { Logger } from '@acme/observability';

const logger = Logger.create({ serviceName: 'my-service' });

const connection = new RabbitMQConnection(
  {
    url: 'amqp://localhost:5672',
    exchange: 'events',
    poolSize: 5,
    enableDLQ: true,
    maxRetries: 3,
  },
  logger
);

await connection.connect();
```

### 2. Publish Events

```typescript
import { RabbitMQEventPublisher } from '@acme/messaging-rabbitmq';

const publisher = new RabbitMQEventPublisher(connection, logger);

await publisher.publish({
  eventId: '123',
  eventType: 'UserCreated',
  eventVersion: '1.0',
  timestamp: new Date().toISOString(),
  correlationId: 'abc-123',
  payload: {
    userId: '456',
    email: 'user@example.com',
  },
});
```

### 3. Consume Events

```typescript
import { RabbitMQEventConsumer } from '@acme/messaging-rabbitmq';

const consumer = new RabbitMQEventConsumer(
  connection,
  logger,
  {
    queue: 'user-service',
    durable: true,
    enableRetry: true,
    maxRetries: 3,
  }
);

consumer.subscribe('UserCreated', {
  handle: async (envelope) => {
    console.log('User created:', envelope.payload);
  },
});

consumer.subscribe('UserUpdated', {
  handle: async (envelope) => {
    console.log('User updated:', envelope.payload);
  },
});

await consumer.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await consumer.stop();
  await connection.close();
});
```

## Configuration

### RabbitMQConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `url` | `string` | - | Connection URL (amqp://user:pass@host:port/vhost) |
| `exchange` | `string` | - | Exchange name for publishing |
| `exchangeType` | `'topic' \| 'direct' \| 'fanout' \| 'headers'` | `'topic'` | Exchange type |
| `poolSize` | `number` | `5` | Number of channels in pool |
| `connectionTimeout` | `number` | `30000` | Connection timeout in ms |
| `heartbeat` | `number` | `60` | Heartbeat interval in seconds |
| `prefetchCount` | `number` | `10` | Prefetch count for consumers |
| `enableDLQ` | `boolean` | `true` | Enable dead letter queue |
| `dlqExchangeSuffix` | `string` | `'.dlq'` | DLQ exchange suffix |
| `dlqQueueSuffix` | `string` | `'.dlq'` | DLQ queue suffix |
| `maxRetries` | `number` | `3` | Max retry attempts |
| `retryDelay` | `number` | `5000` | Retry delay in ms |

### RabbitMQConsumerOptions

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `queue` | `string` | - | Queue name |
| `routingKey` | `string` | `eventType` | Routing key pattern |
| `autoAck` | `boolean` | `false` | Auto-acknowledge messages |
| `exclusive` | `boolean` | `false` | Exclusive queue |
| `durable` | `boolean` | `true` | Durable queue |
| `enableRetry` | `boolean` | `true` | Enable retry mechanism |
| `maxRetries` | `number` | `3` | Max retry attempts |
| `retryDelay` | `number` | `5000` | Retry delay in ms |

## Advanced Usage

### Batch Publishing

```typescript
const events = [
  {
    eventId: '1',
    eventType: 'UserCreated',
    eventVersion: '1.0',
    timestamp: new Date().toISOString(),
    payload: { userId: '1' },
  },
  {
    eventId: '2',
    eventType: 'UserCreated',
    eventVersion: '1.0',
    timestamp: new Date().toISOString(),
    payload: { userId: '2' },
  },
];

await publisher.publishBatch(events);
```

### Custom Routing Keys

```typescript
const consumer = new RabbitMQEventConsumer(
  connection,
  logger,
  {
    queue: 'notifications',
    routingKey: 'user.*', // Matches UserCreated, UserUpdated, etc.
    durable: true,
  }
);
```

### Health Monitoring

```typescript
const health = await connection.healthCheck();

console.log('Is Healthy:', health.isHealthy);
console.log('Status:', health.connectionStatus); // 'connected' | 'disconnected' | 'reconnecting'
console.log('Channels:', health.channelCount);
console.log('Last Error:', health.lastError);
```

### Retry with Exponential Backoff

The consumer automatically retries failed messages with exponential backoff:

- **Attempt 1**: Immediate
- **Attempt 2**: 5 seconds delay
- **Attempt 3**: 10 seconds delay (5 * 2^1)
- **Attempt 4**: 20 seconds delay (5 * 2^2)
- **DLQ**: After max retries exceeded

```typescript
const consumer = new RabbitMQEventConsumer(
  connection,
  logger,
  {
    queue: 'orders',
    enableRetry: true,
    maxRetries: 3,
    retryDelay: 5000, // Base delay
  }
);
```

### Dead Letter Queue

Failed messages are automatically sent to DLQ after max retries:

```typescript
const connection = new RabbitMQConnection(
  {
    url: 'amqp://localhost',
    exchange: 'events',
    enableDLQ: true,
    dlqExchangeSuffix: '.dlq',
    dlqQueueSuffix: '.dlq',
  },
  logger
);

// DLQ Exchange: events.dlq
// DLQ Queue: your-queue.dlq
```

DLQ messages include metadata:
- `x-death-reason`: Error message
- `x-death-timestamp`: Timestamp
- `x-original-exchange`: Original exchange
- `x-original-routing-key`: Original routing key

### Message Deduplication

The consumer automatically deduplicates messages using `eventId`:

```typescript
// This message will be processed only once
await publisher.publish({
  eventId: 'unique-123',
  eventType: 'OrderPlaced',
  // ...
});

// Duplicate - will be skipped
await publisher.publish({
  eventId: 'unique-123', // Same ID
  eventType: 'OrderPlaced',
  // ...
});
```

## Architecture

```mermaid
graph LR
    A[Application] -->|publish| B[RabbitMQEventPublisher]
    B -->|channel.publish| C[RabbitMQ Exchange]
    C -->|route| D[Queue 1]
    C -->|route| E[Queue 2]
    
    D -->|consume| F[RabbitMQEventConsumer 1]
    E -->|consume| G[RabbitMQEventConsumer 2]
    
    F -->|failed| H[DLQ Exchange]
    G -->|failed| H
    
    H -->|route| I[DLQ Queue]
    
    B -.->|pool| J[RabbitMQConnection]
    F -.->|pool| J
    G -.->|pool| J
```

### Clean Architecture Compliance

This adapter follows Clean Architecture principles:

- **Domain Independence**: Uses `@acme/messaging` ports (EventPublisherPort, EventConsumer)
- **Framework Boundary**: RabbitMQ implementation details isolated
- **Dependency Inversion**: Application depends on abstractions, not concrete RabbitMQ
- **Testability**: Easily mockable for unit tests

## Comparison: RabbitMQ vs Kafka vs EventBridge

| Feature | RabbitMQ | Kafka | EventBridge |
|---------|----------|-------|-------------|
| **Message Model** | Queue/Exchange | Log/Stream | Event Bus |
| **Throughput** | Moderate (10K-50K msg/s) | High (100K+ msg/s) | Moderate (10K msg/s) |
| **Latency** | Low (ms) | Low (ms) | Moderate (ms-s) |
| **Ordering** | Queue-level | Partition-level | None |
| **Durability** | Disk/Memory | Disk (log) | AWS-managed |
| **Protocol** | AMQP | Binary | HTTP/AWS SDK |
| **DLQ** | ✅ Native | ⚠️ Manual | ✅ Native |
| **Retry** | ✅ Built-in | ⚠️ Manual | ✅ Built-in |
| **Schema** | ⚠️ Manual | ✅ Registry | ⚠️ Manual |
| **Multi-tenancy** | ✅ Virtual hosts | ⚠️ Topics | ✅ Event buses |
| **Setup** | Self-hosted | Self-hosted | Serverless |
| **Cost** | Server costs | Server costs | Pay-per-event |

**Use RabbitMQ when:**
- Task queues with retry logic needed
- Moderate throughput requirements
- Complex routing patterns required
- DLQ and retry are critical
- Traditional messaging patterns preferred

**Use Kafka when:**
- High throughput streaming required
- Event sourcing/CQRS patterns
- Log aggregation and analytics
- Strong ordering guarantees needed
- Event replay capability important

**Use EventBridge when:**
- AWS-native architecture
- Serverless applications
- Cross-account event routing
- Schema discovery needed
- No infrastructure management desired

## Best Practices

### 1. Connection Management

```typescript
// ✅ DO: Reuse connection and publisher/consumer instances
const connection = new RabbitMQConnection(config, logger);
await connection.connect();

const publisher = new RabbitMQEventPublisher(connection, logger);
const consumer = new RabbitMQEventConsumer(connection, logger, options);

// ❌ DON'T: Create new connection per publish
for (const event of events) {
  const conn = new RabbitMQConnection(config, logger); // ❌ Bad
  await conn.connect();
  // ...
}
```

### 2. Error Handling

```typescript
// ✅ DO: Handle errors in consumer handlers
consumer.subscribe('UserCreated', {
  handle: async (envelope) => {
    try {
      await processUser(envelope.payload);
    } catch (error) {
      logger.error('Failed to process user', error);
      throw error; // Let retry/DLQ mechanism handle it
    }
  },
});
```

### 3. Graceful Shutdown

```typescript
// ✅ DO: Always close connections on shutdown
process.on('SIGTERM', async () => {
  await consumer.stop();
  await connection.close();
  process.exit(0);
});
```

### 4. Idempotency

```typescript
// ✅ DO: Use unique eventId for deduplication
await publisher.publish({
  eventId: UUID.v4(), // Unique ID
  eventType: 'OrderPlaced',
  // ...
});
```

### 5. Correlation ID

```typescript
// ✅ DO: Propagate correlation ID
await publisher.publish({
  eventId: UUID.v4(),
  correlationId: request.correlationId, // From upstream
  causationId: currentEventId, // Current event that caused this
  eventType: 'PaymentProcessed',
  // ...
});
```

## Testing

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RabbitMQEventPublisher } from '@acme/messaging-rabbitmq';

describe('Event Publishing', () => {
  let publisher: RabbitMQEventPublisher;
  let mockConnection: MockRabbitMQConnection;

  beforeEach(() => {
    mockConnection = createMockConnection();
    publisher = new RabbitMQEventPublisher(mockConnection, mockLogger);
  });

  it('should publish event to exchange', async () => {
    await publisher.publish({
      eventId: '123',
      eventType: 'UserCreated',
      eventVersion: '1.0',
      timestamp: new Date().toISOString(),
      payload: { userId: '456' },
    });

    expect(mockConnection.getChannel().publish).toHaveBeenCalledWith(
      'events',
      'UserCreated',
      expect.any(Buffer),
      expect.objectContaining({ messageId: '123' })
    );
  });
});
```

## Dependencies

- `amqplib`: RabbitMQ client library
- `@acme/kernel`: Core domain types
- `@acme/messaging`: Messaging ports and contracts
- `@acme/observability`: Logging interfaces

## License

MIT
