/**
 * Pagination support for TypeORM repositories
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- TypeORM framework boundary: repository methods */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- TypeORM framework boundary: entity properties */
/* eslint-disable @typescript-eslint/no-unsafe-call -- TypeORM framework boundary: repository methods */
import type { Repository, FindManyOptions, ObjectLiteral, FindOptionsOrder } from 'typeorm';
import type { Page, PageRequest, Sort } from '@acme/persistence';
import type { TypeORMMapper } from './TypeORMMapper';

/**
 * Helper class for paginated queries in TypeORM
 *
 * @example
 * ```typescript
 * const paginator = new TypeORMPaginator(repository, mapper);
 *
 * const page = await paginator.findPage(
 *   { page: 1, pageSize: 20, sort: [{ field: 'name', direction: 'asc' }] },
 *   { where: { active: true } }
 * );
 *
 * console.log(page.items.length); // Up to 20 items
 * console.log(page.total);        // Total count
 * console.log(page.hasNext);      // true if more pages available
 * ```
 */
export class TypeORMPaginator<TDomain, TPersistence extends ObjectLiteral> {
  constructor(
    private readonly repository: Repository<TPersistence>,
    private readonly mapper: TypeORMMapper<TDomain, TPersistence>
  ) {}

  /**
   * Find paginated results
   */
  async findPage(
    pageRequest: PageRequest,
    findOptions?: FindManyOptions<TPersistence>
  ): Promise<Page<TDomain>> {
    const { page, pageSize, sort } = pageRequest;
    const skip = (page - 1) * pageSize;

    const options: FindManyOptions<TPersistence> = {
      ...findOptions,
      skip,
      take: pageSize,
    };

    const order = this.buildOrder(sort);
    if (order !== undefined) {
      options.order = order;
    }

    const [entities, total] = await this.repository.findAndCount(options);

    const items = entities.map((e) => this.mapper.toDomain(e));

    return {
      items,
      total,
      page,
      pageSize,
      hasNext: skip + pageSize < total,
      hasPrevious: page > 1,
    };
  }

  /**
   * Build TypeORM order clause from sort array
   */
  private buildOrder(
    sort?: Sort[]
  ): FindOptionsOrder<TPersistence> | undefined {
    if (sort === undefined || sort.length === 0) {
      return undefined;
    }

    const order: Record<string, 'ASC' | 'DESC'> = {};
    for (const s of sort) {
      order[s.field] = s.direction === 'asc' ? 'ASC' : 'DESC';
    }

    return order as FindOptionsOrder<TPersistence>;
  }
}
