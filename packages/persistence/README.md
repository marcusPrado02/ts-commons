# @marcusprado02/persistence

**Persistence Abstractions** - Repository interfaces, pagination primitives, and query optimization utilities.

## Installation

```
pnpm add @marcusprado02/persistence
```

## Key Exports

| Export                        | Kind  | Description                                   |
| ----------------------------- | ----- | --------------------------------------------- |
| `RepositoryPort`              | type  | Full read/write repository interface          |
| `ReadRepositoryPort`          | type  | Read-only repository interface                |
| `WriteRepositoryPort`         | type  | Write-only repository interface               |
| `Page`, `PageRequest`, `Sort` | types | Pagination primitives                         |
| `DataLoader`                  | class | Batches and deduplicates DB queries (N+1 fix) |
| `N1Detector`                  | class | Detects N+1 query patterns at runtime         |
| `QueryResultCache`            | class | In-memory query result caching                |
| `ConnectionPoolMonitor`       | class | Tracks connection pool health                 |
| `QueryPlanner`                | class | Analyzes and explains query plans             |

## Usage

### Implementing a typed repository

```typescript
import { RepositoryPort, Page, PageRequest } from '@marcusprado02/persistence';

interface Order {
  id: string;
  customerId: string;
  total: number;
}

class OrderRepository implements RepositoryPort<Order, string> {
  async findById(id: string): Promise<Order | null> {
    return db.query('SELECT * FROM orders WHERE id = $1', [id]);
  }

  async findAll(request: PageRequest): Promise<Page<Order>> {
    const rows = await db.query('SELECT * FROM orders LIMIT $1 OFFSET $2', [
      request.size,
      request.page * request.size,
    ]);
    return { content: rows, totalElements: await db.count('orders'), ...request };
  }

  async save(order: Order): Promise<Order> {
    return db.upsert('orders', order);
  }
}
```

### Eliminating N+1 queries with DataLoader

```typescript
import { DataLoader } from '@marcusprado02/persistence';

const customerLoader = new DataLoader<string, Customer>(async (ids) => {
  const customers = await db.query('SELECT * FROM customers WHERE id = ANY($1)', [ids]);
  return ids.map((id) => customers.find((c) => c.id === id) ?? null);
});

// Called once per request cycle - batched into a single DB query
const [alice, bob] = await Promise.all([
  customerLoader.load('cust-1'),
  customerLoader.load('cust-2'),
]);
```

### Monitoring connection pool health

```typescript
import { ConnectionPoolMonitor } from '@marcusprado02/persistence';

const monitor = new ConnectionPoolMonitor(pool, { sampleIntervalMs: 5_000 });

monitor.onRecommendation((rec) => {
  if (rec.type === 'INCREASE_POOL_SIZE') {
    logger.warn('Pool saturation detected', rec);
  }
});

monitor.start();
```

## Dependencies

- `@marcusprado02/kernel` - domain primitives and identity types
