# Guide: Building a Microservice

This guide walks through building a complete `orders-service` microservice using ts-commons packages from domain model to production-ready HTTP server.

---

## Project Structure

```
orders-service/
├── src/
│   ├── domain/
│   │   ├── Order.ts                    # AggregateRoot
│   │   ├── OrderId.ts                  # ValueObject (typed ID)
│   │   ├── Money.ts                    # ValueObject
│   │   ├── OrderItem.ts                # Value Object
│   │   ├── OrderRepository.ts          # Port
│   │   └── events/
│   │       └── OrderPlacedEvent.ts
│   │
│   ├── application/
│   │   └── usecases/
│   │       ├── PlaceOrderUseCase.ts
│   │       └── GetOrderUseCase.ts
│   │
│   ├── infrastructure/
│   │   ├── persistence/
│   │   │   └── PrismaOrderRepository.ts
│   │   ├── messaging/
│   │   │   └── KafkaOrderPublisher.ts
│   │   └── config/
│   │       └── bootstrap.ts
│   │
│   └── transport/
│       └── OrderController.ts
│
├── main.ts
├── package.json
└── tsconfig.json
```

---

## 1. Domain Layer

### `Money` ValueObject

```typescript
// src/domain/Money.ts
import { ValueObject, Result } from '@marcusprado02/kernel';

export class Money extends ValueObject<{ amount: number; currency: string }> {
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

  add(other: Money): Result<Money, Error> {
    if (this.currency !== other.currency) return Result.err(new Error('Currency mismatch'));
    return Money.create(this.amount + other.amount, this.currency);
  }
}
```

### `Order` Aggregate

```typescript
// src/domain/Order.ts
import { AggregateRoot, Result, UUID } from '@marcusprado02/kernel';
import { Money } from './Money.js';
import { OrderPlacedEvent } from './events/OrderPlacedEvent.js';

export class Order extends AggregateRoot<string> {
  private _status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' = 'PENDING';
  private _items: OrderItem[];
  private _total: Money;
  readonly customerId: string;
  readonly createdAt: Date;

  private constructor(id: string, customerId: string, items: OrderItem[], total: Money) {
    super(id);
    this.customerId = customerId;
    this._items = items;
    this._total = total;
    this.createdAt = new Date();
  }

  static place(customerId: string, items: OrderItem[]): Result<Order, Error> {
    if (items.length === 0) return Result.err(new Error('Order must have at least one item'));

    const totalResult = items
      .map((i) => Money.create(i.price * i.qty, 'BRL'))
      .reduce((acc, r) => acc.flatMap((a) => r.flatMap((b) => a.add(b))), Money.create(0, 'BRL'));

    if (totalResult.isErr()) return Result.err(totalResult.unwrapErr());

    const id = UUID.generate();
    const order = new Order(id, customerId, items, totalResult.unwrap());
    order.addDomainEvent(new OrderPlacedEvent(id, customerId, order._total));
    return Result.ok(order);
  }

  static reconstitute(props: OrderState): Order {
    const order = new Order(props.id, props.customerId, props.items, props.total);
    order._status = props.status;
    return order;
  }

  get status() {
    return this._status;
  }
  get total() {
    return this._total;
  }
  get items() {
    return this._items as readonly OrderItem[];
  }
}
```

### Domain Event

```typescript
// src/domain/events/OrderPlacedEvent.ts
import { DomainEvent } from '@marcusprado02/kernel';
import type { Money } from '../Money.js';

export class OrderPlacedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly total: Money,
  ) {
    super({ aggregateId: orderId });
  }
}
```

### Repository Port

```typescript
// src/domain/OrderRepository.ts
import type { RepositoryPort } from '@marcusprado02/persistence';
import type { Order } from './Order.js';

export interface OrderRepository extends RepositoryPort<Order> {
  findByCustomerId(customerId: string): Promise<Order[]>;
  findPending(): Promise<Order[]>;
}
```

---

## 2. Application Layer

### `PlaceOrderUseCase`

```typescript
// src/application/usecases/PlaceOrderUseCase.ts
import { UseCase } from '@marcusprado02/application';
import { Result } from '@marcusprado02/kernel';
import { OutboxStorePort } from '@marcusprado02/outbox';
import { Order } from '../../domain/Order.js';
import type { OrderRepository } from '../../domain/OrderRepository.js';

export interface PlaceOrderInput {
  customerId: string;
  items: Array<{ productId: string; qty: number; price: number }>;
}

export type PlaceOrderOutput = { orderId: string };

export class PlaceOrderUseCase implements UseCase<PlaceOrderInput, PlaceOrderOutput> {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly orderRepo: OrderRepository,
    private readonly outboxStore: OutboxStorePort,
  ) {}

  async execute(input: PlaceOrderInput): Promise<Result<PlaceOrderOutput, Error>> {
    return this.uow.run(async () => {
      const orderResult = Order.place(input.customerId, input.items);
      if (orderResult.isErr()) return Result.err(orderResult.unwrapErr());

      const order = orderResult.unwrap();
      await this.orderRepo.save(order);

      for (const event of order.pullDomainEvents()) {
        await this.outboxStore.save({
          id: UUID.generate(),
          aggregateId: order.id,
          eventType: event.constructor.name,
          payload: JSON.stringify(event),
          createdAt: new Date(),
          status: 'PENDING',
        });
      }

      return Result.ok({ orderId: order.id });
    });
  }
}
```

---

## 3. Infrastructure Layer

### Prisma Repository

```typescript
// src/infrastructure/persistence/PrismaOrderRepository.ts
import { PrismaRepository } from '@marcusprado02/persistence-prisma';
import type { PrismaClient } from '@prisma/client';
import { Order } from '../../domain/Order.js';
import type { OrderRepository } from '../../domain/OrderRepository.js';

export class PrismaOrderRepository
  extends PrismaRepository<Order, string>
  implements OrderRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma.order, new OrderMapper());
  }

  async findByCustomerId(customerId: string): Promise<Order[]> {
    const rows = await this.prisma.order.findMany({ where: { customerId } });
    return rows.map(this.mapper.toDomain);
  }

  async findPending(): Promise<Order[]> {
    const rows = await this.prisma.order.findMany({ where: { status: 'PENDING' } });
    return rows.map(this.mapper.toDomain);
  }
}
```

---

## 4. The Complete `main.ts`

```typescript
// src/main.ts
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { KafkaConnection, KafkaEventPublisher } from '@marcusprado02/messaging-kafka';
import { RedisConnection } from '@marcusprado02/cache-redis';
import { ConfigServer, ZodConfigSchema } from '@marcusprado02/config';
import { GracefulShutdown, HealthAggregator } from '@marcusprado02/docker-utils';
import { LoggerFactory } from '@marcusprado02/observability';
import { OtelTracer } from '@marcusprado02/observability-otel';
import { OutboxRelay } from '@marcusprado02/outbox';
import { InMemoryScheduler } from '@marcusprado02/scheduler';
import { CorrelationHook, ErrorHandlerHook } from '@marcusprado02/web-fastify';
import { z } from 'zod';
import { PlaceOrderUseCase } from './application/usecases/PlaceOrderUseCase.js';
import { GetOrderUseCase } from './application/usecases/GetOrderUseCase.js';
import { PrismaOrderRepository } from './infrastructure/persistence/PrismaOrderRepository.js';
import { PrismaOutboxStore } from '@marcusprado02/persistence-prisma';
import { PrismaUnitOfWork } from '@marcusprado02/persistence-prisma';
import type { PlaceOrderInput } from './application/usecases/PlaceOrderUseCase.js';

// ─── 1. Configuration ──────────────────────────────────────────────────────
const config = new ConfigServer();
config.set('http.port', Number(process.env.PORT ?? 3000));
config.set('db.url', process.env.DATABASE_URL ?? '');
config.set('kafka.brokers', process.env.KAFKA_BROKERS ?? 'kafka:9092');
config.set('redis.host', process.env.REDIS_HOST ?? 'redis');
config.set('log.level', process.env.LOG_LEVEL ?? 'info');

new ZodConfigSchema(
  z.object({
    'http.port': z.number().min(1),
    'db.url': z.string().min(1),
  }),
).validate(config.getAll());

const NODE_ENV = process.env.NODE_ENV ?? 'development';

// ─── 2. Logger ─────────────────────────────────────────────────────────────
const factory = new LoggerFactory({
  level: config.get('log.level') as string,
  pretty: NODE_ENV !== 'production',
});
const log = factory.create('main');

// ─── 3. Tracing ────────────────────────────────────────────────────────────
const tracer = new OtelTracer({ serviceName: 'orders-service' });

// ─── 4. Infrastructure ─────────────────────────────────────────────────────
const prisma = new PrismaClient({
  datasources: { db: { url: config.get<string>('db.url')! } },
});
const kafka = new KafkaConnection({
  brokers: [config.get<string>('kafka.brokers')!],
  clientId: 'orders-service',
});
const redis = new RedisConnection({
  host: config.get<string>('redis.host')!,
});

// ─── 5. Repositories ───────────────────────────────────────────────────────
const orderRepo = new PrismaOrderRepository(prisma);
const outboxStore = new PrismaOutboxStore(prisma);
const uow = new PrismaUnitOfWork(prisma);

// ─── 6. Use Cases ──────────────────────────────────────────────────────────
const publisher = new KafkaEventPublisher(kafka, { topic: 'orders.events' });
const placeOrderUseCase = new PlaceOrderUseCase(uow, orderRepo, outboxStore);
const getOrderUseCase = new GetOrderUseCase(orderRepo);

// ─── 7. Background Workers ─────────────────────────────────────────────────
const relay = new OutboxRelay(outboxStore, publisher, {
  pollingIntervalMs: 5_000,
  batchSize: 50,
});

const scheduler = new InMemoryScheduler();
scheduler.scheduleInterval('expire-old-orders', {
  intervalMs: 300_000, // 5 minutes
  handler: () =>
    orderRepo
      .findPending()
      .then((orders) => orders.forEach((o) => log.info('Checking order', { id: o.id }))),
});

// ─── 8. HTTP Server ────────────────────────────────────────────────────────
const app = Fastify({ logger: false });
app.addHook('onRequest', CorrelationHook.create());
app.setErrorHandler(ErrorHandlerHook.create());

app.post('/orders', async (request, reply) => {
  const span = tracer.startSpan('POST /orders');
  const result = await placeOrderUseCase.execute(request.body as PlaceOrderInput);
  span.end();

  result.match({
    ok: (data) => reply.status(201).send(data),
    err: (error) => reply.status(422).send({ error: error.message }),
  });
});

app.get('/orders/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const result = await getOrderUseCase.execute({ orderId: id });

  result.match({
    ok: (order) => reply.send(order),
    err: (_err) => reply.status(404).send({ error: 'Order not found' }),
  });
});

// ─── 9. Health Checks ──────────────────────────────────────────────────────
const health = new HealthAggregator();
health.register('database', async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { status: 'UP' as const };
});
health.register('kafka', async () => {
  const ok = await kafka.ping();
  return { status: ok ? ('UP' as const) : ('DOWN' as const) };
});

app.get('/health', async (_, r) => r.send(await health.check()));
app.get('/health/ready', async (_, r) => r.send(await health.checkReady()));

// ─── 10. Graceful Shutdown ─────────────────────────────────────────────────
const shutdown = new GracefulShutdown({ timeoutMs: 30_000 });
shutdown.register('http', () => app.close());
shutdown.register('relay', () => relay.stop());
shutdown.register('scheduler', () => scheduler.stop());
shutdown.register('kafka', () => kafka.disconnect());
shutdown.register('redis', () => redis.disconnect());
shutdown.register('db', () => prisma.$disconnect());
shutdown.listen();

// ─── 11. Startup ───────────────────────────────────────────────────────────
await prisma.$connect();
await kafka.connect();
await relay.start();
await scheduler.start();
await app.listen({
  port: config.get<number>('http.port')!,
  host: '0.0.0.0',
});

log.info('orders-service started', {
  port: config.get('http.port'),
  env: NODE_ENV,
});
```

---

## Package Checklist

| Concern              | Package                                                              |
| -------------------- | -------------------------------------------------------------------- |
| Domain model         | `@marcusprado02/kernel`                                              |
| Use cases            | `@marcusprado02/application`                                         |
| Validation           | `@marcusprado02/validation`                                          |
| Configuration        | `@marcusprado02/config`                                              |
| Persistence (Prisma) | `@marcusprado02/persistence-prisma`                                  |
| Messaging (Kafka)    | `@marcusprado02/messaging-kafka`                                     |
| Outbox pattern       | `@marcusprado02/outbox`                                              |
| Resilience           | `@marcusprado02/resilience`                                          |
| Security             | `@marcusprado02/security`                                            |
| Observability        | `@marcusprado02/observability` + `@marcusprado02/observability-otel` |
| HTTP transport       | `@marcusprado02/web-fastify`                                         |
| Cache                | `@marcusprado02/cache-redis`                                         |
| Background jobs      | `@marcusprado02/scheduler`                                           |
| Health + shutdown    | `@marcusprado02/docker-utils`                                        |
| Tests                | `@marcusprado02/testing`                                             |
