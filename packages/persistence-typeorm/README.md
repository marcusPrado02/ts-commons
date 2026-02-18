# @acme/persistence-typeorm

TypeORM adapter for Clean Architecture persistence patterns.

## Features

- **TypeORMRepository**: Base repository implementation with full CRUD operations
- **TypeORMUnitOfWork**: Transaction management with Unit of Work pattern
- **TypeORMPaginator**: Built-in pagination support with sorting
- **TypeORMMapper**: Interface for domain-persistence entity mapping
- **Type-safe**: Fully typed with TypeScript strict mode
- **Framework isolation**: Clean separation between domain and persistence layers

## Installation

```bash
pnpm add @acme/persistence-typeorm
```

## Quick Start

### 1. Define Your Entities

```typescript
// Domain entity (kernel)
interface User {
  id: UserId;
  name: string;
  email: Email;
  createdAt: Date;
}

interface UserId {
  value: string;
}

// TypeORM persistence entity
import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('users')
class UserEntity {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column()
  email!: string;

  @Column()
  createdAt!: Date;
}
```

### 2. Implement Mapper

```typescript
import { TypeORMMapper } from '@acme/persistence-typeorm';

class UserMapper implements TypeORMMapper<User, UserEntity> {
  toPersistence(domain: User): UserEntity {
    const entity = new UserEntity();
    entity.id = domain.id.value;
    entity.name = domain.name;
    entity.email = domain.email.value;
    entity.createdAt = domain.createdAt;
    return entity;
  }

  toDomain(persistence: UserEntity): User {
    return {
      id: { value: persistence.id },
      name: persistence.name,
      email: { value: persistence.email },
      createdAt: persistence.createdAt,
    };
  }
}
```

### 3. Create Repository

```typescript
import { TypeORMRepository } from '@acme/persistence-typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';

class UserRepository extends TypeORMRepository<User, UserId, UserEntity> {
  constructor(
    repository: Repository<UserEntity>,
    mapper: UserMapper
  ) {
    super(repository, mapper);
  }

  protected getIdValue(id: UserId): string {
    return id.value;
  }

  protected getWhereClause(id: UserId): FindOptionsWhere<UserEntity> {
    return { id: this.getIdValue(id) };
  }

  // Add custom methods
  async findByEmail(email: Email): Promise<User | null> {
    const entities = await this.findMany({
      where: { email: email.value },
    });
    return entities[0] ?? null;
  }
}
```

### 4. Use Repository

```typescript
import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'user',
  password: 'pass',
  database: 'mydb',
  entities: [UserEntity],
  synchronize: false,
});

await dataSource.initialize();

const typeormRepo = dataSource.getRepository(UserEntity);
const mapper = new UserMapper();
const userRepo = new UserRepository(typeormRepo, mapper);

// CRUD operations
const user: User = {
  id: { value: '123' },
  name: 'John Doe',
  email: { value: 'john@example.com' },
  createdAt: new Date(),
};

await userRepo.save(user);

const found = await userRepo.findById({ value: '123' });
console.log(found?.name); // "John Doe"

const all = await userRepo.findAll();
console.log(all.length);

const exists = await userRepo.exists({ value: '123' });
console.log(exists); // true

await userRepo.delete({ value: '123' });
```

## Unit of Work & Transactions

```typescript
import { TypeORMUnitOfWork } from '@acme/persistence-typeorm';

const unitOfWork = new TypeORMUnitOfWork(dataSource);

// All operations committed together
await unitOfWork.transaction(async (manager) => {
  const userRepo = manager.getRepository(UserEntity);
  const orderRepo = manager.getRepository(OrderEntity);

  await userRepo.save(user);
  await orderRepo.save(order);

  // Both saves are committed if no error occurs
  // Rolled back automatically on error
});

// With Result type
import { Result } from '@acme/kernel';

const result = await unitOfWork.transactionResult<void, Error>(
  async (manager) => {
    const userRepo = manager.getRepository(UserEntity);
    await userRepo.save(user);
    return Result.ok(undefined);
  }
);

if (result.isOk()) {
  console.log('Transaction successful');
} else {
  console.error('Transaction failed:', result.unwrapErr());
}
```

## Pagination

```typescript
import { TypeORMPaginator } from '@acme/persistence-typeorm';
import { PageRequest } from '@acme/persistence';

const paginator = new TypeORMPaginator(typeormRepo, mapper);

const pageRequest: PageRequest = {
  page: 1,
  pageSize: 20,
  sort: [
    { field: 'name', direction: 'asc' },
    { field: 'createdAt', direction: 'desc' },
  ],
};

const page = await paginator.findPage(pageRequest, {
  where: { active: true },
});

console.log(page.items);       // Up to 20 items
console.log(page.total);       // Total count
console.log(page.hasNext);     // true if more pages
console.log(page.hasPrevious); // true if not first page
```

## Advanced Usage

### Custom Query Methods

```typescript
class UserRepository extends TypeORMRepository<User, UserId, UserEntity> {
  // ... base implementation

  async findActive(): Promise<User[]> {
    return await this.findMany({
      where: { active: true },
      order: { name: 'ASC' },
    });
  }

  async countByStatus(status: string): Promise<number> {
    return await this.countMany({
      where: { status },
    });
  }

  async findRecent(limit: number): Promise<User[]> {
    return await this.findMany({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
```

### Soft Deletes

```typescript
@Entity('users')
class UserEntity {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @DeleteDateColumn()
  deletedAt?: Date;
}

class UserRepository extends TypeORMRepository<User, UserId, UserEntity> {
  async softDelete(id: UserId): Promise<void> {
    const where = this.getWhereClause(id);
    await this.repository.softDelete(where);
  }

  async restore(id: UserId): Promise<void> {
    const where = this.getWhereClause(id);
    await this.repository.restore(where);
  }
}
```

### Optimistic Locking

```typescript
@Entity('users')
class UserEntity {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @VersionColumn()
  version!: number;
}

// TypeORM handles optimistic locking automatically
// Throws OptimisticLockVersionMismatchError on concurrent updates
```

## Architecture

This adapter follows Clean Architecture principles:

- **Domain Layer**: Pure business entities (User, UserId)
- **Application Layer**: Repository ports (RepositoryPort)
- **Infrastructure Layer**: TypeORM implementations (TypeORMRepository)

```
┌─────────────────────────────────────┐
│         Domain Layer                │
│  (User, UserId, Email)              │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Application Layer              │
│  (RepositoryPort interface)         │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    Infrastructure Layer             │
│  (TypeORMRepository, UserEntity)    │
└─────────────────────────────────────┘
```

## Testing

The package includes comprehensive unit tests:

```bash
pnpm test
```

Mock the TypeORM repository in your tests:

```typescript
import { vi } from 'vitest';

const mockRepository = {
  save: vi.fn(),
  findOne: vi.fn(),
  find: vi.fn(),
  count: vi.fn(),
  delete: vi.fn(),
};

const userRepo = new UserRepository(mockRepository, mapper);
```

## Best Practices

1. **Keep domain entities framework-free**: Never import TypeORM decorators in domain entities
2. **Use mappers**: Always convert between domain and persistence models
3. **Encapsulate TypeORM**: Hide TypeORM details behind repository interface
4. **Test with mocks**: Test repositories without database connection
5. **Use transactions**: Group related operations in Unit of Work
6. **Paginate large results**: Use TypeORMPaginator for better performance
7. **Handle optimistic locking**: Use version columns for concurrent updates

## Comparison with Other ORMs

| Feature | TypeORM | Prisma | Mongoose |
|---------|---------|--------|----------|
| TypeScript Support | ✅ Native | ✅ Native | ⚠️ Partial |
| Multiple Databases | ✅ Yes | ✅ Yes | ❌ MongoDB only |
| Migrations | ✅ Built-in | ✅ Built-in | ❌ Manual |
| Type Safety | ✅ Decorators | ✅ Generated | ⚠️ Schemas |
| Active Record | ✅ Yes | ❌ Data Mapper | ✅ Yes |
| Query Builder | ✅ Yes | ✅ Yes | ✅ Yes |
| Performance | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

## License

MIT
