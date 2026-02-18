/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Vitest mock objects require any-typed assignments */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- Vitest mock arguments */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Vitest mock property access */
/* eslint-disable @typescript-eslint/no-unsafe-call -- Vitest mock call patterns */
/* eslint-disable @typescript-eslint/unbound-method -- Vitest mocking pattern requires unbound methods */
/* eslint-disable @typescript-eslint/explicit-function-return-type -- test helper functions */
/* eslint-disable max-lines-per-function -- test files naturally have longer functions */
/**
 * Tests for @acme/persistence-mongodb adapter
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Result } from '@acme/kernel';
import type { PageRequest } from '@acme/persistence';
import { MongoRepository } from './MongoRepository';
import type { MongoCollectionLike, MongoCursorLike } from './MongoRepository';
import type { MongoMapper } from './MongoMapper';
import { MongoUnitOfWork } from './MongoUnitOfWork';
import type { MongoClientLike, MongoSessionLike } from './MongoUnitOfWork';
import { MongoPaginator } from './MongoPaginator';
import { withActivesOnly, softDeleteData, restoreData } from './MongoSoftDelete';

// ── Shared test domain types ──────────────────────────────────────────────────

interface UserId {
  readonly value: string;
}

interface User {
  readonly id: UserId;
  readonly name: string;
  readonly email: string;
}

type UserDoc = Record<string, unknown>;

// ── Concrete repository under test ────────────────────────────────────────────

class UserMongoRepository extends MongoRepository<User, UserId> {
  protected extractId(entity: User): UserId {
    return entity.id;
  }

  protected getFilter(id: UserId): Record<string, unknown> {
    return { _id: id.value };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUser(id = '1'): User {
  return { id: { value: id }, name: 'Alice', email: 'alice@example.com' };
}

function makeDoc(id = '1'): UserDoc {
  return { _id: id, name: 'Alice', email: 'alice@example.com' };
}

function buildCursor(): MongoCursorLike {
  return {
    sort:    vi.fn().mockReturnThis(),
    skip:    vi.fn().mockReturnThis(),
    limit:   vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue([]),
  } as unknown as MongoCursorLike;
}

function buildCollection(cursor: MongoCursorLike): MongoCollectionLike {
  return {
    findOne:        vi.fn(),
    find:           vi.fn().mockReturnValue(cursor),
    replaceOne:     vi.fn().mockResolvedValue(undefined),
    deleteOne:      vi.fn().mockResolvedValue(undefined),
    countDocuments: vi.fn(),
  } as unknown as MongoCollectionLike;
}

function buildMapper(): MongoMapper<User> {
  return {
    toDocument: vi.fn((u: User) => makeDoc(u.id.value)),
    toDomain:   vi.fn((d: UserDoc) => ({
      id:    { value: d['_id'] as string },
      name:  d['name'] as string,
      email: d['email'] as string,
    })),
  };
}

// ── MongoRepository ───────────────────────────────────────────────────────────

describe('MongoRepository', () => {
  let cursor: MongoCursorLike;
  let collection: MongoCollectionLike;
  let mapper: MongoMapper<User>;
  let repo: UserMongoRepository;

  beforeEach(() => {
    cursor     = buildCursor();
    collection = buildCollection(cursor);
    mapper     = buildMapper();
    repo       = new UserMongoRepository(collection, mapper);
  });

  it('save() should call replaceOne with upsert:true and the mapped document', async () => {
    const user = makeUser();

    await repo.save(user);

    expect(collection.replaceOne).toHaveBeenCalledWith(
      { _id: '1' },
      makeDoc(),
      { upsert: true },
    );
    expect(mapper.toDocument).toHaveBeenCalledWith(user);
  });

  it('findById() should return the mapped domain entity when found', async () => {
    vi.mocked(collection.findOne).mockResolvedValue(makeDoc());

    const result = await repo.findById({ value: '1' });

    expect(result).toEqual(makeUser());
    expect(collection.findOne).toHaveBeenCalledWith({ _id: '1' });
    expect(mapper.toDomain).toHaveBeenCalledWith(makeDoc());
  });

  it('findById() should return null when no document matches', async () => {
    vi.mocked(collection.findOne).mockResolvedValue(null);

    const result = await repo.findById({ value: '999' });

    expect(result).toBeNull();
  });

  it('findAll() should return all documents mapped to domain entities', async () => {
    vi.mocked(cursor.toArray).mockResolvedValue([makeDoc('1'), makeDoc('2')]);

    const results = await repo.findAll();

    expect(results).toHaveLength(2);
    expect(collection.find).toHaveBeenCalledWith();
    expect(mapper.toDomain).toHaveBeenCalledTimes(2);
  });

  it('exists() should return true when a document with the given id exists', async () => {
    vi.mocked(collection.countDocuments).mockResolvedValue(1);

    const result = await repo.exists({ value: '1' });

    expect(result).toBe(true);
    expect(collection.countDocuments).toHaveBeenCalledWith({ _id: '1' });
  });

  it('exists() should return false when no document matches the given id', async () => {
    vi.mocked(collection.countDocuments).mockResolvedValue(0);

    const result = await repo.exists({ value: '999' });

    expect(result).toBe(false);
  });

  it('delete() should call deleteOne with the correct filter', async () => {
    await repo.delete({ value: '1' });

    expect(collection.deleteOne).toHaveBeenCalledWith({ _id: '1' });
  });
});

// ── MongoUnitOfWork ───────────────────────────────────────────────────────────

describe('MongoUnitOfWork', () => {
  let session: MongoSessionLike;
  let client: MongoClientLike;
  let unitOfWork: MongoUnitOfWork;

  beforeEach(() => {
    const sessionImpl: MongoSessionLike = {
      withTransaction: vi.fn().mockImplementation(
        (fn: () => Promise<unknown>) => fn(),
      ),
      endSession: vi.fn().mockResolvedValue(undefined),
    };
    session = sessionImpl;
    client  = { startSession: vi.fn().mockReturnValue(session) };
    unitOfWork = new MongoUnitOfWork(client);
  });

  it('withTransaction() should execute the work function inside session.withTransaction', async () => {
    const work = vi.fn().mockResolvedValue('done');

    const result = await unitOfWork.withTransaction(work);

    expect(result).toBe('done');
    expect(client.startSession).toHaveBeenCalledOnce();
    expect(session.withTransaction).toHaveBeenCalledOnce();
    expect(work).toHaveBeenCalledWith(session);
  });

  it('withTransactionResult() should return the Result value produced by work', async () => {
    const okResult = Result.ok<number, Error>(42);
    const work = vi.fn().mockResolvedValue(okResult);

    const result = await unitOfWork.withTransactionResult<number, Error>(work);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(42);
  });

  it('endSession() should be called after withTransaction completes', async () => {
    const work = vi.fn().mockResolvedValue(undefined);

    await unitOfWork.withTransaction(work);

    expect(session.endSession).toHaveBeenCalledOnce();
  });
});

// ── MongoPaginator ────────────────────────────────────────────────────────────

describe('MongoPaginator', () => {
  let cursor: MongoCursorLike;
  let collection: MongoCollectionLike;
  let mapper: MongoMapper<User>;
  let paginator: MongoPaginator<User>;

  beforeEach(() => {
    cursor     = buildCursor();
    mapper     = buildMapper();
    collection = buildCollection(cursor);
    paginator  = new MongoPaginator(collection, mapper);
  });

  it('findPage() should return items, total, and correct pagination flags', async () => {
    vi.mocked(cursor.toArray).mockResolvedValue([makeDoc('1'), makeDoc('2')]);
    vi.mocked(collection.countDocuments).mockResolvedValue(5);

    const pageRequest: PageRequest = { page: 1, pageSize: 2 };
    const page = await paginator.findPage(pageRequest);

    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(5);
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(2);
    expect(page.hasNext).toBe(true);      // 0 + 2 < 5
    expect(page.hasPrevious).toBe(false); // page 1
    expect(cursor.sort).not.toHaveBeenCalled();
  });

  it('findPage() should call cursor.sort() with MongoDB direction values (1 / -1)', async () => {
    vi.mocked(cursor.toArray).mockResolvedValue([makeDoc()]);
    vi.mocked(collection.countDocuments).mockResolvedValue(10);

    await paginator.findPage({
      page: 1,
      pageSize: 10,
      sort: [
        { field: 'name',      direction: 'asc'  },
        { field: 'createdAt', direction: 'desc' },
      ],
    });

    expect(cursor.sort).toHaveBeenCalledWith({ name: 1, createdAt: -1 });
  });

  it('findPage() should return hasNext:false and hasPrevious:true for a later page', async () => {
    vi.mocked(cursor.toArray).mockResolvedValue([makeDoc()]);
    vi.mocked(collection.countDocuments).mockResolvedValue(10);

    // page=3, pageSize=4 → skip=8, skip+pageSize=12 >= 10 → hasNext=false
    const page = await paginator.findPage({ page: 3, pageSize: 4 });

    expect(page.hasNext).toBe(false);
    expect(page.hasPrevious).toBe(true);
  });
});

// ── Soft delete utilities ─────────────────────────────────────────────────────

describe('Soft delete utilities', () => {
  it('withActivesOnly() should merge the provided filter with { deletedAt: null }', () => {
    const result = withActivesOnly({ organizationId: 'org-1' });

    expect(result).toEqual({ organizationId: 'org-1', deletedAt: null });
  });

  it('softDeleteData() should return an object with deletedAt as a Date instance', () => {
    const result = softDeleteData();

    expect(result['deletedAt']).toBeInstanceOf(Date);
  });

  it('restoreData() should return { deletedAt: null }', () => {
    expect(restoreData()).toEqual({ deletedAt: null });
  });
});
