/**
 * Abstract Prisma repository implementing Clean Architecture repository port.
 *
 * Accepts a typed Prisma model delegate (e.g. `prisma.user`) instead of the
 * full PrismaClient, giving consumers full type inference while keeping the
 * library independent of generated Prisma types.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Prisma framework boundary: delegate methods return any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Prisma framework boundary: record properties */
/* eslint-disable @typescript-eslint/no-unsafe-call -- Prisma framework boundary: delegate method calls */
import type { RepositoryPort } from '@acme/persistence';
import type { PrismaMapper } from './PrismaMapper';

/**
 * Structural interface that matches the shape of every Prisma model delegate.
 * Pass `prisma.user`, `prisma.order`, etc. as the `model` constructor argument.
 */
export interface PrismaModelDelegate {
  findUnique(args: {
    where: Record<string, unknown>;
    select?: Record<string, unknown> | null;
  }): Promise<Record<string, unknown> | null>;

  findMany(args?: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, unknown> | Record<string, unknown>[];
    skip?: number;
    take?: number;
    select?: Record<string, unknown> | null;
  }): Promise<Record<string, unknown>[]>;

  upsert(args: {
    where: Record<string, unknown>;
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;

  delete(args: {
    where: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;

  count(args?: {
    where?: Record<string, unknown>;
  }): Promise<number>;
}

/**
 * Abstract base repository for Prisma ORM.
 *
 * @template TDomain - Domain entity type
 * @template TId - ID value object type
 *
 * @example
 * ```typescript
 * class UserRepository extends PrismaRepository<User, UserId> {
 *   constructor(prisma: PrismaClient, mapper: UserMapper) {
 *     super(prisma.user as unknown as PrismaModelDelegate, mapper);
 *   }
 *
 *   protected extractId(entity: User): UserId {
 *     return entity.id;
 *   }
 *
 *   protected getWhereClause(id: UserId): Record<string, unknown> {
 *     return { id: id.value };
 *   }
 * }
 * ```
 */
export abstract class PrismaRepository<TDomain, TId>
  implements RepositoryPort<TDomain, TId>
{
  constructor(
    protected readonly model: PrismaModelDelegate,
    protected readonly mapper: PrismaMapper<TDomain>,
  ) {}

  /**
   * Extract the ID value object from a domain entity.
   * Used internally by save() to build the upsert where clause.
   */
  protected abstract extractId(entity: TDomain): TId;

  /**
   * Build a Prisma `where` plain object from an ID value object.
   *
   * @example
   * ```typescript
   * protected getWhereClause(id: UserId): Record<string, unknown> {
   *   return { id: id.value };
   * }
   * ```
   */
  protected abstract getWhereClause(id: TId): Record<string, unknown>;

  /**
   * Persist a domain entity (create or update).
   * Uses Prisma upsert so callers do not need to distinguish new vs existing.
   */
  async save(entity: TDomain): Promise<void> {
    const id = this.extractId(entity);
    const data = this.mapper.toPersistence(entity);
    await this.model.upsert({
      where: this.getWhereClause(id),
      create: data,
      update: data,
    });
  }

  /**
   * Find a domain entity by its ID.
   * Returns null when no record matches.
   */
  async findById(id: TId): Promise<TDomain | null> {
    const record = await this.model.findUnique({
      where: this.getWhereClause(id),
    });
    if (record === null) return null;
    return this.mapper.toDomain(record);
  }

  /**
   * Return all domain entities in the table (no filtering).
   * Use PrismaPaginator for large data sets.
   */
  async findAll(): Promise<TDomain[]> {
    const records = await this.model.findMany();
    return records.map((r) => this.mapper.toDomain(r));
  }

  /**
   * Check whether an entity with the given ID exists.
   */
  async exists(id: TId): Promise<boolean> {
    const count = await this.model.count({
      where: this.getWhereClause(id),
    });
    return count > 0;
  }

  /**
   * Hard-delete an entity by its ID.
   * For soft delete see PrismaSoftDelete utilities.
   */
  async delete(id: TId): Promise<void> {
    await this.model.delete({
      where: this.getWhereClause(id),
    });
  }
}
