# @acme/persistence-prisma

Prisma ORM adapter for Clean Architecture repositories.

Provides typed base classes and utilities for the repository pattern, unit of
work, pagination, and soft-delete — all **independent of generated Prisma
types**, so no `@prisma/client` import is needed inside this library.

---

## Features

- **`PrismaRepository<T, TId>`** — Abstract CRUD base repository (upsert, findById, findAll, exists, delete)
- **`PrismaPaginator<T>`** — Cursor-free offset pagination with optional `where` filter and `orderBy` sorting
- **`PrismaUnitOfWork`** — `$transaction`-backed unit of work with `Result<T, E>` support
- **`PrismaMapper<T>`** — Bidirectional mapper interface (domain ↔ Prisma record)
- **Soft-delete utilities** — `withActivesOnly()`, `softDeleteData()`, `restoreData()`
- **No generated-type dependency** — accepts structural `PrismaModelDelegate` / `PrismaClientLike` interfaces
- TypeScript strict mode (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) ✅
- ESLint compliant ✅

---

## Architecture

```
Domain Layer
  └── Entity (User, Order, …)

Application Layer
  └── RepositoryPort<T, TId>   ← implements ←   PrismaRepository (Infrastructure)

Infrastructure Layer
  └── PrismaRepository
  └── PrismaPaginator
  └── PrismaUnitOfWork
  └── Soft-delete helpers
           ↑
      PrismaClient (generated)
```

---

## Installation

```bash
pnpm add @acme/persistence-prisma @prisma/client prisma
```

---

## Quick Start

### 1. Define a Mapper

```typescript
import type { PrismaMapper } from '@acme/persistence-prisma';

interface User {
  id: { value: string };
  name: string;
  email: string;
}

export class UserMapper implements PrismaMapper<User> {
  toPersistence(domain: User): Record<string, unknown> {
    return {
      id:    domain.id.value,
      name:  domain.name,
      email: domain.email,
    };
  }

  toDomain(record: Record<string, unknown>): User {
    return {
      id:    { value: record['id'] as string },
      name:  record['name'] as string,
      email: record['email'] as string,
    };
  }
}
```

### 2. Create a Repository

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaRepository, PrismaModelDelegate } from '@acme/persistence-prisma';

interface UserId {
  readonly value: string;
}

export class UserRepository extends PrismaRepository<User, UserId> {
  constructor(prisma: PrismaClient, mapper: UserMapper) {
    // Cast the typed model delegate to the structural interface
    super(prisma.user as unknown as PrismaModelDelegate, mapper);
  }

  protected extractId(entity: User): UserId {
    return entity.id;
  }

  protected getWhereClause(id: UserId): Record<string, unknown> {
    return { id: id.value };
  }
}

// Usage
const prisma  = new PrismaClient();
const repo    = new UserRepository(prisma, new UserMapper());

await repo.save({ id: { value: 'u1' }, name: 'Alice', email: 'alice@example.com' });
const user = await repo.findById({ value: 'u1' });
await repo.delete({ value: 'u1' });
```

### 3. Transactions with Unit of Work

```typescript
import { PrismaUnitOfWork } from '@acme/persistence-prisma';

const uow = new PrismaUnitOfWork(prisma);

await uow.transaction(async (tx) => {
  const userRepo  = new UserRepository(tx as unknown as PrismaClient, new UserMapper());
  const orderRepo = new OrderRepository(tx as unknown as PrismaClient, new OrderMapper());

  await userRepo.save(user);
  await orderRepo.save(order);
  // ↑ Both writes are committed atomically, or both are rolled back
});

// With Result<T, E> return type
import { Result } from '@acme/kernel';

const result = await uow.transactionResult(async (tx) => {
  const repo = new UserRepository(tx as unknown as PrismaClient, new UserMapper());
  const existing = await repo.findById(userId);
  if (existing === null) return Result.err(new Error('User not found'));
  existing.name = 'Bob';
  await repo.save(existing);
  return Result.ok(existing);
});
```

### 4. Pagination

```typescript
import { PrismaPaginator, PrismaModelDelegate } from '@acme/persistence-prisma';

const paginator = new PrismaPaginator(
  prisma.user as unknown as PrismaModelDelegate,
  new UserMapper(),
);

const page = await paginator.findPage(
  { page: 1, pageSize: 20, sort: [{ field: 'name', direction: 'asc' }] },
  { organizationId: 'org-123' },   // where filter (optional)
);

console.log(page.items);      // User[]
console.log(page.total);      // total count
console.log(page.hasNext);    // true/false
console.log(page.hasPrevious);// true/false
```

### 5. Soft Delete

Add a `deletedAt DateTime?` column to your Prisma schema then use the
bundled helpers instead of Prisma's hard `delete`:

```typescript
import {
  withActivesOnly,
  softDeleteData,
  restoreData,
} from '@acme/persistence-prisma';
import type { PrismaModelDelegate } from '@acme/persistence-prisma';

// Extend a repository with soft-delete capability
class SoftDeleteUserRepository extends UserRepository {
  async softDelete(id: UserId): Promise<void> {
    await this.model.update({
      where: this.getWhereClause(id),
      data:  softDeleteData(),
    });
  }

  async restore(id: UserId): Promise<void> {
    await this.model.update({
      where: this.getWhereClause(id),
      data:  restoreData(),
    });
  }

  // Override findAll to exclude deleted records
  async findAll(): Promise<User[]> {
    const records = await this.model.findMany({
      where: withActivesOnly(),
    });
    return records.map((r) => this.mapper.toDomain(r));
  }
}
```

---

## NestJS Integration

```typescript
import { Module, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaUnitOfWork } from '@acme/persistence-prisma';

@Module({
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => new PrismaClient(),
    },
    {
      provide: PrismaUnitOfWork,
      useFactory: (prisma: PrismaClient) => new PrismaUnitOfWork(prisma),
      inject: [PrismaClient],
    },
    {
      provide: 'USER_REPOSITORY',
      useFactory: (prisma: PrismaClient) => new UserRepository(prisma, new UserMapper()),
      inject: [PrismaClient],
    },
  ],
  exports: [PrismaUnitOfWork, 'USER_REPOSITORY'],
})
export class PersistenceModule implements OnModuleInit {
  constructor(private readonly prisma: PrismaClient) {}

  async onModuleInit(): Promise<void> {
    await this.prisma.$connect();
  }
}
```

---

## Configuration Reference

### `PrismaRepository<TDomain, TId>` — Abstract methods

| Method | Required | Description |
|---|---|---|
| `extractId(entity)` | ✅ | Return the ID value object from a domain entity |
| `getWhereClause(id)` | ✅ | Return a Prisma `where` plain object for the given ID |

### `PrismaPaginator.findPage(pageRequest, where?)`

| Parameter | Type | Description |
|---|---|---|
| `pageRequest.page` | `number` | 1-based page number |
| `pageRequest.pageSize` | `number` | Items per page |
| `pageRequest.sort` | `Sort[]?` | Array of `{ field, direction }` |
| `where` | `Record<string, unknown>?` | Optional Prisma where filter |

### `PrismaUnitOfWork`

| Method | Description |
|---|---|
| `transaction(fn)` | Execute inside a Prisma `$transaction` |
| `transactionResult(fn)` | Same, but fn returns `Result<T, E>` |
| `getClient()` | Expose the underlying `PrismaClientLike` |
| `connect()` | Eagerly connect to the database |
| `disconnect()` | Release connection pool (call on shutdown) |

---

## Comparison: Prisma vs TypeORM

| Feature | `@acme/persistence-prisma` | `@acme/persistence-typeorm` |
|---|---|---|
| Type safety | Schema-generated types | Decorator-based entities |
| Migration tool | `prisma migrate` | `typeorm migration:*` |
| Query builder | Prisma Client (type-safe) | QueryBuilder |
| Soft delete | Manual (`deletedAt`) | `@DeleteDateColumn()` |
| Transactions | Interactive `$transaction` | QueryRunner / DataSource |
| Relations | Nested include/select | `relations: [...]` |
| Multi-DB support | PostgreSQL, MySQL, SQLite, SQL Server, MongoDB | Same |
| Schema source | `schema.prisma` | TypeScript entity classes |

---

## Testing

### Unit tests (mocked delegate)

```typescript
import { describe, it, expect, vi } from 'vitest';
import type { PrismaModelDelegate } from '@acme/persistence-prisma';

const model = {
  findUnique: vi.fn().mockResolvedValue({ id: '1', name: 'Alice', email: 'a@b.com' }),
  findMany:   vi.fn(),
  upsert:     vi.fn(),
  delete:     vi.fn(),
  count:      vi.fn(),
} as unknown as PrismaModelDelegate;

const repo = new UserRepository({ user: model } as any, new UserMapper());
```

### Integration tests (real database)

Use `prisma migrate deploy` in a test-scoped PostgreSQL / SQLite instance, or
leverage the `@prisma/client` mock generator:

```bash
pnpm prisma migrate dev --name=test_schema
DATABASE_URL="postgresql://user:pass@localhost:5432/test_db" pnpm test:integration
```

---

## Prisma Schema Example

```prisma
model User {
  id        String    @id @default(uuid())
  name      String
  email     String    @unique
  deletedAt DateTime? // for soft delete
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  orders    Order[]
}

model OutboxMessage {
  id          String    @id @default(uuid())
  eventType   String
  payload     Json
  occurredOn  DateTime  @default(now())
  publishedAt DateTime?
  attempts    Int       @default(0)

  @@index([publishedAt, attempts])
}
```

---

## Package Structure

```
packages/persistence-prisma/
├── src/
│   ├── PrismaMapper.ts          # Bidirectional mapper interface
│   ├── PrismaRepository.ts      # Abstract base CRUD repository + PrismaModelDelegate
│   ├── PrismaUnitOfWork.ts      # $transaction wrapper + PrismaClientLike interface
│   ├── PrismaPaginator.ts       # Offset pagination helper
│   ├── PrismaSoftDelete.ts      # Soft delete pure functions
│   ├── index.ts                 # Public API exports
│   └── persistence-prisma.test.ts  # 16 unit tests
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```
