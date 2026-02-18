/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Vitest mock objects require any-typed assignments */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- Vitest mock arguments */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Vitest mock property access */
/* eslint-disable @typescript-eslint/no-unsafe-call -- Vitest mock call patterns */
/* eslint-disable @typescript-eslint/unbound-method -- Vitest mocking pattern requires unbound methods */
/* eslint-disable @typescript-eslint/explicit-function-return-type -- test helper functions */
/* eslint-disable max-lines-per-function -- test files naturally have longer functions */
/**
 * Tests for @acme/persistence-prisma adapter
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Result } from '@acme/kernel';
import type { PageRequest } from '@acme/persistence';
import { PrismaRepository } from './PrismaRepository';
import type { PrismaModelDelegate } from './PrismaRepository';
import type { PrismaMapper } from './PrismaMapper';
import { PrismaUnitOfWork } from './PrismaUnitOfWork';
import type { PrismaClientLike } from './PrismaUnitOfWork';
import { PrismaPaginator } from './PrismaPaginator';
import { withActivesOnly, softDeleteData, restoreData } from './PrismaSoftDelete';

// ── Shared test domain types ──────────────────────────────────────────────────

interface UserId {
  readonly value: string;
}

interface User {
  readonly id: UserId;
  readonly name: string;
  readonly email: string;
}

type UserRecord = Record<string, unknown>;

// ── Concrete repository under test ────────────────────────────────────────────

class UserPrismaRepository extends PrismaRepository<User, UserId> {
  protected extractId(entity: User): UserId {
    return entity.id;
  }

  protected getWhereClause(id: UserId): Record<string, unknown> {
    return { id: id.value };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUser(id = '1'): User {
  return { id: { value: id }, name: 'Alice', email: 'alice@example.com' };
}

function makeRecord(id = '1'): UserRecord {
  return { id, name: 'Alice', email: 'alice@example.com' };
}

function buildModel(): PrismaModelDelegate {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  } as unknown as PrismaModelDelegate;
}

function buildMapper(): PrismaMapper<User> {
  return {
    toPersistence: vi.fn((u: User) => makeRecord(u.id.value)),
    toDomain: vi.fn((r: UserRecord) => ({
      id: { value: r['id'] as string },
      name: r['name'] as string,
      email: r['email'] as string,
    })),
  };
}

// ── PrismaRepository ──────────────────────────────────────────────────────────

describe('PrismaRepository', () => {
  let model: PrismaModelDelegate;
  let mapper: PrismaMapper<User>;
  let repo: UserPrismaRepository;

  beforeEach(() => {
    model = buildModel();
    mapper = buildMapper();
    repo = new UserPrismaRepository(model, mapper);
  });

  it('save() should call model.upsert with create and update data', async () => {
    const user = makeUser();
    vi.mocked(model.upsert).mockResolvedValue(makeRecord());

    await repo.save(user);

    expect(model.upsert).toHaveBeenCalledWith({
      where: { id: '1' },
      create: makeRecord(),
      update: makeRecord(),
    });
    expect(mapper.toPersistence).toHaveBeenCalledWith(user);
  });

  it('findById() should return the mapped domain entity when found', async () => {
    vi.mocked(model.findUnique).mockResolvedValue(makeRecord());

    const result = await repo.findById({ value: '1' });

    expect(result).toEqual(makeUser());
    expect(model.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
    expect(mapper.toDomain).toHaveBeenCalledWith(makeRecord());
  });

  it('findById() should return null when no record matches', async () => {
    vi.mocked(model.findUnique).mockResolvedValue(null);

    const result = await repo.findById({ value: '999' });

    expect(result).toBeNull();
  });

  it('findAll() should return all records mapped to domain entities', async () => {
    vi.mocked(model.findMany).mockResolvedValue([makeRecord('1'), makeRecord('2')]);

    const results = await repo.findAll();

    expect(results).toHaveLength(2);
    expect(model.findMany).toHaveBeenCalledWith();
    expect(mapper.toDomain).toHaveBeenCalledTimes(2);
  });

  it('exists() should return true when a record with the given id exists', async () => {
    vi.mocked(model.count).mockResolvedValue(1);

    const result = await repo.exists({ value: '1' });

    expect(result).toBe(true);
    expect(model.count).toHaveBeenCalledWith({ where: { id: '1' } });
  });

  it('exists() should return false when no record matches the given id', async () => {
    vi.mocked(model.count).mockResolvedValue(0);

    const result = await repo.exists({ value: '999' });

    expect(result).toBe(false);
  });

  it('delete() should call model.delete with correct where clause', async () => {
    vi.mocked(model.delete).mockResolvedValue(makeRecord());

    await repo.delete({ value: '1' });

    expect(model.delete).toHaveBeenCalledWith({ where: { id: '1' } });
  });
});

// ── PrismaUnitOfWork ──────────────────────────────────────────────────────────

describe('PrismaUnitOfWork', () => {
  let prisma: PrismaClientLike;
  let unitOfWork: PrismaUnitOfWork;

  beforeEach(() => {
    // $transaction calls the work fn with the same client (interactive tx)
    const client: PrismaClientLike = {
      $transaction: vi.fn().mockImplementation((fn: (tx: PrismaClientLike) => Promise<unknown>) =>
        fn(client),
      ),
      $disconnect: vi.fn().mockResolvedValue(undefined),
      $connect: vi.fn().mockResolvedValue(undefined),
    };
    prisma = client;
    unitOfWork = new PrismaUnitOfWork(prisma);
  });

  it('transaction() should execute the work function inside $transaction', async () => {
    const work = vi.fn().mockResolvedValue('done');

    const result = await unitOfWork.transaction(work);

    expect(result).toBe('done');
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(work).toHaveBeenCalledWith(prisma);
  });

  it('transactionResult() should return the Result value produced by work', async () => {
    const okResult = Result.ok<number, Error>(42);
    const work = vi.fn().mockResolvedValue(okResult);

    const result = await unitOfWork.transactionResult<number, Error>(work);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(42);
  });

  it('disconnect() should call $disconnect on the underlying client', async () => {
    await unitOfWork.disconnect();

    expect(prisma.$disconnect).toHaveBeenCalledOnce();
  });
});

// ── PrismaPaginator ───────────────────────────────────────────────────────────

describe('PrismaPaginator', () => {
  let model: PrismaModelDelegate;
  let mapper: PrismaMapper<User>;
  let paginator: PrismaPaginator<User>;

  beforeEach(() => {
    model = buildModel();
    mapper = buildMapper();
    paginator = new PrismaPaginator(model, mapper);
  });

  it('findPage() should return first page with correct pagination metadata', async () => {
    vi.mocked(model.findMany).mockResolvedValue([makeRecord('1'), makeRecord('2')]);
    vi.mocked(model.count).mockResolvedValue(10);

    const req: PageRequest = { page: 1, pageSize: 2 };
    const page = await paginator.findPage(req);

    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(10);
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(2);
    expect(page.hasNext).toBe(true);
    expect(page.hasPrevious).toBe(false);
    expect(model.findMany).toHaveBeenCalledWith({ skip: 0, take: 2 });
  });

  it('findPage() with sorting should pass orderBy to findMany', async () => {
    vi.mocked(model.findMany).mockResolvedValue([makeRecord()]);
    vi.mocked(model.count).mockResolvedValue(1);

    const req: PageRequest = {
      page: 1,
      pageSize: 10,
      sort: [{ field: 'name', direction: 'asc' }],
    };

    await paginator.findPage(req);

    expect(model.findMany).toHaveBeenCalledWith({
      orderBy: [{ name: 'asc' }],
      skip: 0,
      take: 10,
    });
  });

  it('findPage() on last page should set hasPrevious=true and hasNext=false', async () => {
    vi.mocked(model.findMany).mockResolvedValue([makeRecord('3')]);
    vi.mocked(model.count).mockResolvedValue(3);

    const req: PageRequest = { page: 2, pageSize: 2 };
    const page = await paginator.findPage(req);

    expect(page.hasNext).toBe(false);
    expect(page.hasPrevious).toBe(true);
  });
});

// ── Soft delete utilities ─────────────────────────────────────────────────────

describe('Soft delete utilities', () => {
  it('withActivesOnly() should merge existing where clause with deletedAt:null', () => {
    const result = withActivesOnly({ organizationId: 'org-1' });

    expect(result).toEqual({ organizationId: 'org-1', deletedAt: null });
  });

  it('softDeleteData() should return an object with a current Date timestamp', () => {
    const before = new Date();
    const data = softDeleteData();
    const after = new Date();

    expect(data['deletedAt']).toBeInstanceOf(Date);
    const deletedAt = data['deletedAt'] as Date;
    expect(deletedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(deletedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('restoreData() should return { deletedAt: null } to clear the tombstone', () => {
    const data = restoreData();

    expect(data).toEqual({ deletedAt: null });
  });
});
