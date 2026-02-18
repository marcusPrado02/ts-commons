/* eslint-disable @typescript-eslint/unbound-method -- Vitest mocking pattern requires unbound methods */
/* eslint-disable max-lines-per-function -- Test files naturally have longer functions for setup and assertions */
/**
 * Tests for TypeORM Repository implementation
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Repository, FindOptionsWhere } from 'typeorm';
import { TypeORMRepository } from './TypeORMRepository';
import type { TypeORMMapper } from './TypeORMMapper';

// Test domain entity
interface User {
  id: UserId;
  name: string;
  email: string;
}

interface UserId {
  value: string;
}

// Test persistence entity
interface UserEntity {
  id: string;
  name: string;
  email: string;
}

// Test repository implementation
class UserRepository extends TypeORMRepository<User, UserId, UserEntity> {
  protected getIdValue(id: UserId): string {
    return id.value;
  }

  protected getWhereClause(id: UserId): FindOptionsWhere<UserEntity> {
    return { id: this.getIdValue(id) } as FindOptionsWhere<UserEntity>;
  }
}

describe('TypeORMRepository', () => {
  let repository: Repository<UserEntity>;
  let mapper: TypeORMMapper<User, UserEntity>;
  let userRepository: UserRepository;

  beforeEach(() => {
    // Mock TypeORM repository
    repository = {
      save: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    } as unknown as Repository<UserEntity>;

    // Mock mapper
    mapper = {
      toPersistence: vi.fn((user: User) => ({
        id: user.id.value,
        name: user.name,
        email: user.email,
      })),
      toDomain: vi.fn((entity: UserEntity) => ({
        id: { value: entity.id },
        name: entity.name,
        email: entity.email,
      })),
    };

    userRepository = new UserRepository(repository, mapper);
  });

  describe('save', () => {
    it('should save entity to database', async () => {
      const user: User = {
        id: { value: '1' },
        name: 'John Doe',
        email: 'john@example.com',
      };

      await userRepository.save(user);

      expect(mapper.toPersistence).toHaveBeenCalledWith(user);
      expect(repository.save).toHaveBeenCalledWith({
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
      });
    });
  });

  describe('findById', () => {
    it('should find entity by id', async () => {
      const entity: UserEntity = {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
      };

      vi.mocked(repository.findOne).mockResolvedValue(entity);

      const result = await userRepository.findById({ value: '1' });

      expect(result).toEqual({
        id: { value: '1' },
        name: 'John Doe',
        email: 'john@example.com',
      });
      expect(mapper.toDomain).toHaveBeenCalledWith(entity);
    });

    it('should return null when entity not found', async () => {
      vi.mocked(repository.findOne).mockResolvedValue(null);

      const result = await userRepository.findById({ value: '999' });

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should find all entities', async () => {
      const entities: UserEntity[] = [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Doe', email: 'jane@example.com' },
      ];

      vi.mocked(repository.find).mockResolvedValue(entities);

      const result = await userRepository.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]!.name).toBe('John Doe');
      expect(result[1]!.name).toBe('Jane Doe');
      expect(mapper.toDomain).toHaveBeenCalledTimes(2);
    });

    it('should return empty array when no entities found', async () => {
      vi.mocked(repository.find).mockResolvedValue([]);

      const result = await userRepository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('exists', () => {
    it('should return true when entity exists', async () => {
      vi.mocked(repository.count).mockResolvedValue(1);

      const result = await userRepository.exists({ value: '1' });

      expect(result).toBe(true);
    });

    it('should return false when entity does not exist', async () => {
      vi.mocked(repository.count).mockResolvedValue(0);

      const result = await userRepository.exists({ value: '999' });

      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete entity by id', async () => {
      await userRepository.delete({ value: '1' });

      expect(repository.delete).toHaveBeenCalledWith({ id: '1' });
    });
  });
});
