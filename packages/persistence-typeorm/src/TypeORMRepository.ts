/**
 * Base TypeORM repository implementing Clean Architecture repository port
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- TypeORM framework boundary: repository methods return any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- TypeORM framework boundary: entity properties */
/* eslint-disable @typescript-eslint/no-unsafe-call -- TypeORM framework boundary: repository methods */
import type { Repository, FindOptionsWhere, FindManyOptions, ObjectLiteral } from 'typeorm';
import type { RepositoryPort } from '@acme/persistence';
import type { TypeORMMapper } from './TypeORMMapper';

/**
 * Abstract base repository for TypeORM
 *
 * @template TDomain - Domain entity type
 * @template TId - ID value object type
 * @template TPersistence - TypeORM persistence entity type
 *
 * @example
 * ```typescript
 * class UserRepository extends TypeORMRepository<User, UserId, UserEntity> {
 *   constructor(
 *     repository: Repository<UserEntity>,
 *     mapper: TypeORMMapper<User, UserEntity>
 *   ) {
 *     super(repository, mapper);
 *   }
 *
 *   protected getIdValue(id: UserId): string {
 *     return id.value;
 *   }
 *
 *   protected getWhereClause(id: UserId): FindOptionsWhere<UserEntity> {
 *     return { id: this.getIdValue(id) } as FindOptionsWhere<UserEntity>;
 *   }
 * }
 * ```
 */
export abstract class TypeORMRepository<TDomain, TId, TPersistence extends ObjectLiteral>
  implements RepositoryPort<TDomain, TId>
{
  constructor(
    protected readonly repository: Repository<TPersistence>,
    protected readonly mapper: TypeORMMapper<TDomain, TPersistence>
  ) {}

  /**
   * Extract primitive ID value from ID value object
   */
  protected abstract getIdValue(id: TId): string | number;

  /**
   * Build where clause for TypeORM query
   */
  protected abstract getWhereClause(
    id: TId
  ): FindOptionsWhere<TPersistence>;

  /**
   * Save domain entity to database
   */
  async save(entity: TDomain): Promise<void> {
    const persistence = this.mapper.toPersistence(entity);
    await this.repository.save(persistence);
  }

  /**
   * Find entity by ID
   */
  async findById(id: TId): Promise<TDomain | null> {
    const where = this.getWhereClause(id);
    const entity = await this.repository.findOne({ where });

    if (entity === null) {
      return null;
    }

    return this.mapper.toDomain(entity);
  }

  /**
   * Find all entities
   */
  async findAll(): Promise<TDomain[]> {
    const entities = await this.repository.find();
    return entities.map((e) => this.mapper.toDomain(e));
  }

  /**
   * Check if entity exists by ID
   */
  async exists(id: TId): Promise<boolean> {
    const where = this.getWhereClause(id);
    const count = await this.repository.count({ where });
    return count > 0;
  }

  /**
   * Delete entity by ID
   */
  async delete(id: TId): Promise<void> {
    const where = this.getWhereClause(id);
    await this.repository.delete(where);
  }

  /**
   * Find entities with custom options
   */
  protected async findMany(
    options?: FindManyOptions<TPersistence>
  ): Promise<TDomain[]> {
    const entities = await this.repository.find(options);
    return entities.map((e) => this.mapper.toDomain(e));
  }

  /**
   * Count entities with custom options
   */
  protected async countMany(
    options?: FindManyOptions<TPersistence>
  ): Promise<number> {
    return await this.repository.count(options);
  }
}
