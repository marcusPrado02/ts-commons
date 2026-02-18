/* eslint-disable @typescript-eslint/unbound-method -- Vitest mocking pattern requires unbound methods */
/* eslint-disable max-lines-per-function -- Test files naturally have longer functions for setup and assertions */
/**
 * Tests for TypeORM Paginator
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Repository } from 'typeorm';
import { TypeORMPaginator } from './TypeORMPaginator';
import type { TypeORMMapper } from './TypeORMMapper';
import type { PageRequest } from '@acme/persistence';

interface User {
  id: { value: string };
  name: string;
}

interface UserEntity {
  id: string;
  name: string;
}

describe('TypeORMPaginator', () => {
  let repository: Repository<UserEntity>;
  let mapper: TypeORMMapper<User, UserEntity>;
  let paginator: TypeORMPaginator<User, UserEntity>;

  beforeEach(() => {
    repository = {
      findAndCount: vi.fn(),
    } as unknown as Repository<UserEntity>;

    mapper = {
      toPersistence: vi.fn(),
      toDomain: vi.fn((entity: UserEntity) => ({
        id: { value: entity.id },
        name: entity.name,
      })),
    };

    paginator = new TypeORMPaginator(repository, mapper);
  });

  it('should return first page of results', async () => {
    const entities: UserEntity[] = [
      { id: '1', name: 'User 1' },
      { id: '2', name: 'User 2' },
    ];

    vi.mocked(repository.findAndCount).mockResolvedValue([entities, 10]);

    const pageRequest: PageRequest = {
      page: 1,
      pageSize: 2,
    };

    const result = await paginator.findPage(pageRequest);

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(10);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(2);
    expect(result.hasNext).toBe(true);
    expect(result.hasPrevious).toBe(false);
  });

  it('should return second page with previous flag', async () => {
    const entities: UserEntity[] = [
      { id: '3', name: 'User 3' },
      { id: '4', name: 'User 4' },
    ];

    vi.mocked(repository.findAndCount).mockResolvedValue([entities, 10]);

    const pageRequest: PageRequest = {
      page: 2,
      pageSize: 2,
    };

    const result = await paginator.findPage(pageRequest);

    expect(result.hasNext).toBe(true);
    expect(result.hasPrevious).toBe(true);
  });

  it('should return last page without next flag', async () => {
    const entities: UserEntity[] = [{ id: '10', name: 'User 10' }];

    vi.mocked(repository.findAndCount).mockResolvedValue([entities, 10]);

    const pageRequest: PageRequest = {
      page: 5,
      pageSize: 2,
    };

    const result = await paginator.findPage(pageRequest);

    expect(result.hasNext).toBe(false);
    expect(result.hasPrevious).toBe(true);
  });

  it('should apply sort by single field ascending', async () => {
    vi.mocked(repository.findAndCount).mockResolvedValue([[], 0]);

    const pageRequest: PageRequest = {
      page: 1,
      pageSize: 10,
      sort: [{ field: 'name', direction: 'asc' }],
    };

    await paginator.findPage(pageRequest);

    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { name: 'ASC' },
      })
    );
  });

  it('should apply sort by multiple fields', async () => {
    vi.mocked(repository.findAndCount).mockResolvedValue([[], 0]);

    const pageRequest: PageRequest = {
      page: 1,
      pageSize: 10,
      sort: [
        { field: 'name', direction: 'asc' },
        { field: 'id', direction: 'desc' },
      ],
    };

    await paginator.findPage(pageRequest);

    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { name: 'ASC', id: 'DESC' },
      })
    );
  });

  it('should calculate correct skip value for pagination', async () => {
    vi.mocked(repository.findAndCount).mockResolvedValue([[], 0]);

    const pageRequest: PageRequest = {
      page: 3,
      pageSize: 20,
    };

    await paginator.findPage(pageRequest);

    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 40, // (3-1) * 20
        take: 20,
      })
    );
  });
});
