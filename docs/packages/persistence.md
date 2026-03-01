# @acme/persistence

Repository abstraction, pagination, and Unit of Work. Adapters live in separate packages so your domain only depends on the ports defined here.

**Core install:** `pnpm add @acme/persistence @acme/kernel`

**Adapter installs:**

- `pnpm add @acme/persistence-prisma`
- `pnpm add @acme/persistence-mongodb`
- `pnpm add @acme/persistence-typeorm`

---

## `RepositoryPort<T>` — Port (Interface)

Defines the contract every repository implements. Reference this in your domain layer.

```typescript
import { RepositoryPort } from '@acme/persistence';

// Define domain-specific methods in addition to the base CRUD methods
export interface OrderRepository extends RepositoryPort<Order> {
  findByCustomerId(customerId: string): Promise<Order[]>;
  findPending(): Promise<Order[]>;
  expireOlderThan(cutoff: Date): Promise<number>;
}
```

`RepositoryPort<T>` provides:

| Method     | Signature                                 |
| ---------- | ----------------------------------------- |
| `findById` | `(id: string) => Promise<T \| null>`      |
| `findAll`  | `(filter?: Partial<T>) => Promise<T[]>`   |
| `findPage` | `(opts: PageOptions) => Promise<Page<T>>` |
| `save`     | `(entity: T) => Promise<void>`            |
| `delete`   | `(id: string) => Promise<void>`           |
| `exists`   | `(id: string) => Promise<boolean>`        |

---

## `PrismaRepository` — Prisma Adapter

```typescript
import { PrismaRepository, PrismaUnitOfWork } from '@acme/persistence-prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class PrismaOrderRepository
  extends PrismaRepository<Order, OrderId>
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
    const rows = await this.prisma.order.findMany({
      where: { status: 'PENDING' },
    });
    return rows.map(this.mapper.toDomain);
  }

  async expireOlderThan(cutoff: Date): Promise<number> {
    const { count } = await this.prisma.order.updateMany({
      where: { status: 'PENDING', createdAt: { lt: cutoff } },
      data: { status: 'EXPIRED' },
    });
    return count;
  }
}

// Unit of Work
const uow = new PrismaUnitOfWork(prisma);
await uow.run(async () => {
  await orderRepo.save(order);
  await outboxStore.save(event);
});
```

---

## `MongoRepository` — MongoDB Adapter

```typescript
import { MongoRepository } from '@acme/persistence-mongodb';
import { MongoClient } from 'mongodb';

const client = new MongoClient(connectionString);

export class MongoOrderRepository
  extends MongoRepository<Order, OrderId>
  implements OrderRepository
{
  constructor(client: MongoClient) {
    super(client.db('orders').collection('orders'), new OrderMongoMapper());
  }

  async findByCustomerId(customerId: string): Promise<Order[]> {
    return this.findMany({ customerId });
  }

  async findPending(): Promise<Order[]> {
    return this.findMany({ status: 'PENDING' });
  }

  async expireOlderThan(cutoff: Date): Promise<number> {
    const result = await this.collection.updateMany(
      { status: 'PENDING', createdAt: { $lt: cutoff } },
      { $set: { status: 'EXPIRED' } },
    );
    return result.modifiedCount;
  }
}
```

---

## `Page<T>` — Pagination

```typescript
import { Page, PageOptions } from '@acme/persistence';

const opts: PageOptions = {
  page: 1,
  pageSize: 20,
  filter: { status: 'PENDING' },
  sort: { createdAt: 'desc' },
};

const page: Page<Order> = await orderRepo.findPage(opts);

console.log(page.items); // Order[]
console.log(page.total); // total record count
console.log(page.hasNext); // boolean
console.log(page.hasPrev); // boolean
console.log(page.totalPages);
```

---

## Implementing a Mapper

Each adapter requires a `Mapper` to convert between domain entities and persistence rows:

```typescript
import type { Mapper } from '@acme/persistence';

export class OrderMapper implements Mapper<Order, OrderRow> {
  toDomain(row: OrderRow): Order {
    return Order.reconstitute({
      id: OrderId.from(row.id),
      customerId: row.customerId,
      status: row.status as OrderStatus,
      total: Money.create(row.totalAmount, row.currency).unwrap(),
      createdAt: row.createdAt,
    });
  }

  toPersistence(order: Order): OrderRow {
    return {
      id: order.id.value,
      customerId: order.customerId,
      status: order.status,
      totalAmount: order.total.amount,
      currency: order.total.currency,
      createdAt: order.createdAt,
    };
  }
}
```

---

## Summary

| Export                     | Package               | Purpose                                  |
| -------------------------- | --------------------- | ---------------------------------------- |
| `RepositoryPort<T>`        | `persistence`         | Port — domain interface for repositories |
| `Page<T>` / `PageOptions`  | `persistence`         | Pagination types                         |
| `Mapper<D, R>`             | `persistence`         | Domain ↔ persistence row conversion      |
| `PrismaRepository<T, ID>`  | `persistence-prisma`  | Prisma adapter base class                |
| `PrismaUnitOfWork`         | `persistence-prisma`  | Prisma transaction scope                 |
| `MongoRepository<T, ID>`   | `persistence-mongodb` | MongoDB adapter base class               |
| `MongoUnitOfWork`          | `persistence-mongodb` | MongoDB session-based UoW                |
| `TypeOrmRepository<T, ID>` | `persistence-typeorm` | TypeORM adapter base class               |
