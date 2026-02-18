# @acme/persistence-mongodb

MongoDB native driver adapter for Clean Architecture repositories.

Provides typed base classes and utilities for the repository pattern, unit of
work, pagination, and soft-delete — all **independent of generated driver
types**, so no `mongodb` import is required inside this library.

---

## Features

- **`MongoRepository<T, TId>`** — Abstract CRUD base repository (replaceOne/upsert, findById, findAll, exists, deleteOne)
- **`MongoPaginator<T>`** — Cursor-based offset pagination with optional `filter` and `sort` (asc/desc → 1/-1)
- **`MongoUnitOfWork`** — `ClientSession.withTransaction()`-backed unit of work with `Result<T, E>` support
- **`MongoMapper<T>`** — Bidirectional mapper interface (domain ↔ MongoDB document)
- **Soft-delete utilities** — `withActivesOnly()`, `softDeleteData()`, `restoreData()`
- **No generated-type dependency** — accepts structural `MongoCollectionLike` / `MongoClientLike` interfaces
- TypeScript strict mode (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) ✅
- ESLint compliant ✅

---

## Architecture

```
Domain Layer
  └── Entity (User, Order, …)

Application Layer
  └── RepositoryPort<T, TId>   ← implements ←   MongoRepository (Infrastructure)

Infrastructure Layer
  └── MongoRepository
  └── MongoPaginator
  └── MongoUnitOfWork
  └── Soft-delete helpers
           ↑
      MongoClient / Db.collection() (mongodb driver)
```

---

## Installation

```bash
pnpm add @acme/persistence-mongodb mongodb
```

---

## Quick Start

### 1. Define a Mapper

```typescript
import type { MongoMapper } from '@acme/persistence-mongodb';

interface User {
  id: { value: string };
  name: string;
  email: string;
}

export class UserMongoMapper implements MongoMapper<User> {
  toDocument(domain: User): Record<string, unknown> {
    return {
      _id:   domain.id.value,
      name:  domain.name,
      email: domain.email,
    };
  }

  toDomain(doc: Record<string, unknown>): User {
    return {
      id:    { value: doc['_id'] as string },
      name:  doc['name'] as string,
      email: doc['email'] as string,
    };
  }
}
```

### 2. Create a Repository

```typescript
import { Db } from 'mongodb';
import { MongoRepository, MongoCollectionLike } from '@acme/persistence-mongodb';

interface UserId {
  readonly value: string;
}

export class UserRepository extends MongoRepository<User, UserId> {
  constructor(db: Db, mapper: UserMongoMapper) {
    super(db.collection('users') as unknown as MongoCollectionLike, mapper);
  }

  protected extractId(entity: User): UserId {
    return entity.id;
  }

  protected getFilter(id: UserId): Record<string, unknown> {
    return { _id: id.value };
  }
}

// Usage
const client = new MongoClient(uri);
await client.connect();
const db   = client.db('myapp');
const repo = new UserRepository(db, new UserMongoMapper());

await repo.save({ id: { value: 'u1' }, name: 'Alice', email: 'alice@example.com' });
const user = await repo.findById({ value: 'u1' });
await repo.delete({ value: 'u1' });
```

### 3. Transactions with Unit of Work

```typescript
import { MongoUnitOfWork } from '@acme/persistence-mongodb';

const uow = new MongoUnitOfWork(client);

await uow.withTransaction(async (session) => {
  // Pass the session directly to native collection methods
  await db.collection('users').insertOne(userDoc, { session });
  await db.collection('orders').insertOne(orderDoc, { session });
  // Both writes are committed atomically, or both are rolled back
});

// With Result<T, E> return type
import { Result } from '@acme/kernel';

const result = await uow.withTransactionResult(async (session) => {
  const existing = await db.collection<UserDoc>('users').findOne(
    { _id: userId.value },
    { session },
  );
  if (!existing) return Result.err(new Error('User not found'));
  await db.collection('users').updateOne(
    { _id: userId.value },
    { $set: { name: 'Bob' } },
    { session },
  );
  return Result.ok(existing);
});
```

> **Note**: Multi-document transactions require a MongoDB replica set or sharded
> cluster. They are not available on standalone instances.

### 4. Pagination

```typescript
import { MongoPaginator, MongoCollectionLike } from '@acme/persistence-mongodb';

const paginator = new MongoPaginator(
  db.collection('users') as unknown as MongoCollectionLike,
  new UserMongoMapper(),
);

const page = await paginator.findPage(
  { page: 1, pageSize: 20, sort: [{ field: 'name', direction: 'asc' }] },
  { organizationId: 'org-123', deletedAt: null },  // optional MongoDB filter
);

console.log(page.items);       // User[]
console.log(page.total);       // total matching count
console.log(page.hasNext);     // true/false
console.log(page.hasPrevious); // true/false
```

### 5. Soft Delete

Add a `deletedAt` field to your documents then use the bundled helpers instead
of actually removing documents:

```typescript
import {
  withActivesOnly,
  softDeleteData,
  restoreData,
} from '@acme/persistence-mongodb';

// Query only active (non-deleted) documents
const activeUsers = await db.collection('users').find(
  withActivesOnly({ organizationId: 'org-1' }),
).toArray();
// → filter: { organizationId: 'org-1', deletedAt: null }

// Soft-delete a document
await db.collection('users').updateOne(
  { _id: userId },
  { $set: softDeleteData() },
);
// → sets deletedAt: new Date()

// Restore a soft-deleted document
await db.collection('users').updateOne(
  { _id: userId },
  { $set: restoreData() },
);
// → sets deletedAt: null
```

---

## NestJS Integration

```typescript
import { Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { MongoUnitOfWork } from '@acme/persistence-mongodb';

@Module({
  providers: [
    {
      provide: MongoClient,
      useFactory: async () => {
        const client = new MongoClient(process.env['MONGODB_URI'] ?? '');
        await client.connect();
        return client;
      },
    },
    {
      provide: MongoUnitOfWork,
      useFactory: (client: MongoClient) => new MongoUnitOfWork(client),
      inject: [MongoClient],
    },
    {
      provide: 'USER_REPOSITORY',
      useFactory: (client: MongoClient) =>
        new UserRepository(client.db('myapp'), new UserMongoMapper()),
      inject: [MongoClient],
    },
  ],
  exports: [MongoUnitOfWork, 'USER_REPOSITORY'],
})
export class PersistenceModule implements OnModuleDestroy {
  constructor(private readonly client: MongoClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}
```

---

## Configuration Reference

### `MongoRepository<TDomain, TId>` — Abstract methods

| Method | Required | Description |
|---|---|---|
| `extractId(entity)` | ✅ | Return the ID value object from a domain entity |
| `getFilter(id)` | ✅ | Return a MongoDB filter document `{ _id: id.value }` |

### `MongoPaginator.findPage(pageRequest, filter?)`

| Parameter | Type | Description |
|---|---|---|
| `pageRequest.page` | `number` | 1-based page number |
| `pageRequest.pageSize` | `number` | Items per page |
| `pageRequest.sort` | `Sort[]?` | Array of `{ field, direction }` — maps to `1` / `-1` |
| `filter` | `Record<string, unknown>?` | Optional MongoDB filter document |

### `MongoUnitOfWork`

| Method | Description |
|---|---|
| `withTransaction(fn)` | Execute inside `ClientSession.withTransaction()` |
| `withTransactionResult(fn)` | Same, but fn returns `Result<T, E>` |
| `getClient()` | Expose the underlying `MongoClientLike` |

---

## Structural Interfaces

This library uses structural typing — no `mongodb` package is imported internally.
Any object matching the shape will be accepted.

### `MongoCollectionLike`

```typescript
export interface MongoCollectionLike {
  findOne(filter: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  find(filter?: Record<string, unknown>): MongoCursorLike;
  replaceOne(filter, replacement, options: { upsert: boolean }): Promise<unknown>;
  deleteOne(filter: Record<string, unknown>): Promise<unknown>;
  countDocuments(filter?: Record<string, unknown>): Promise<number>;
}
```

### `MongoClientLike`

```typescript
export interface MongoClientLike {
  startSession(): MongoSessionLike;
}

export interface MongoSessionLike {
  withTransaction<T>(fn: () => Promise<T>): Promise<T>;
  endSession(): Promise<void>;
}
```

Cast your native MongoDB objects at the boundary:

```typescript
db.collection('users') as unknown as MongoCollectionLike
client                  as unknown as MongoClientLike
```

---

## Comparison: MongoDB vs TypeORM vs Prisma

| Feature | `@acme/persistence-mongodb` | `@acme/persistence-typeorm` | `@acme/persistence-prisma` |
|---|---|---|---|
| Data model | Document (JSON) | Relational | Relational |
| Schema | Schemaless / runtime | Entity classes | `schema.prisma` |
| Relations | Manual embedding / references | Join queries | Nested include/select |
| Transactions | `ClientSession.withTransaction` | QueryRunner | Interactive `$transaction` |
| Soft delete | Manual (`deletedAt` filter) | `@DeleteDateColumn()` | Manual (`deletedAt` filter) |
| Pagination | `skip` / `limit` cursor | `skip` / `take` | `skip` / `take` |
| Multi-DB | MongoDB only | Many relational DBs | Many relational DBs |
| ID type | `_id` (ObjectId or string) | Any | Any |

---

## Testing

### Unit tests (mocked collection)

```typescript
import { describe, it, expect, vi } from 'vitest';
import type { MongoCollectionLike, MongoCursorLike } from '@acme/persistence-mongodb';

const cursor: MongoCursorLike = {
  sort:    vi.fn().mockReturnThis(),
  skip:    vi.fn().mockReturnThis(),
  limit:   vi.fn().mockReturnThis(),
  toArray: vi.fn().mockResolvedValue([{ _id: '1', name: 'Alice', email: 'a@b.com' }]),
};

const collection = {
  findOne:        vi.fn().mockResolvedValue({ _id: '1', name: 'Alice', email: 'a@b.com' }),
  find:           vi.fn().mockReturnValue(cursor),
  replaceOne:     vi.fn().mockResolvedValue(undefined),
  deleteOne:      vi.fn().mockResolvedValue(undefined),
  countDocuments: vi.fn().mockResolvedValue(1),
} as unknown as MongoCollectionLike;

const repo = new UserRepository({ collection: () => collection } as any, new UserMongoMapper());
```

### Integration tests (real MongoDB)

Use [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server) for in-process integration tests:

```bash
pnpm add -D mongodb-memory-server
```

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

let mongod: MongoMemoryServer;
let client: MongoClient;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
  await client.close();
  await mongod.stop();
});
```

---

## MongoDB Schema Example

```typescript
// Document shape (no schema file required — MongoDB is schemaless)
interface UserDocument {
  _id: string;           // domain ID stored as string
  name: string;
  email: string;
  organizationId: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Recommended indexes (create on startup)
await db.collection('users').createIndexes([
  { key: { email: 1 },         unique: true },
  { key: { organizationId: 1 } },
  { key: { deletedAt: 1 } },   // speeds up soft-delete filter
  { key: { createdAt: -1 } },  // common sort field
]);
```

---

## Package Structure

```
packages/persistence-mongodb/
├── src/
│   ├── MongoMapper.ts           # Bidirectional mapper interface
│   ├── MongoRepository.ts       # Abstract base CRUD repository + MongoCollectionLike + MongoCursorLike
│   ├── MongoUnitOfWork.ts       # ClientSession wrapper + MongoClientLike + MongoSessionLike
│   ├── MongoPaginator.ts        # Offset pagination helper (skip/limit/sort)
│   ├── MongoSoftDelete.ts       # Soft delete pure functions
│   ├── index.ts                 # Public API exports
│   └── persistence-mongodb.test.ts  # 16 unit tests
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```
