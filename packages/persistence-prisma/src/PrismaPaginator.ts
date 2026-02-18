/**
 * Pagination support for Prisma model delegates.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Prisma framework boundary: delegate methods return any */
/* eslint-disable @typescript-eslint/no-unsafe-call -- Prisma framework boundary: delegate method calls */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- Prisma framework boundary: Sort fields inferred as any through PageRequest */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Prisma framework boundary: Sort.field / Sort.direction inferred as any */
import type { Page, PageRequest, Sort } from '@acme/persistence';
import type { PrismaMapper } from './PrismaMapper';
import type { PrismaModelDelegate } from './PrismaRepository';

/**
 * Helper class for paginated queries using a Prisma model delegate.
 *
 * @example
 * ```typescript
 * const paginator = new PrismaPaginator(prisma.user as unknown as PrismaModelDelegate, mapper);
 *
 * const page = await paginator.findPage(
 *   { page: 1, pageSize: 20, sort: [{ field: 'name', direction: 'asc' }] },
 *   { deletedAt: null },   // optional where filter
 * );
 *
 * console.log(page.items.length); // Up to 20 users
 * console.log(page.total);        // Total matching count
 * console.log(page.hasNext);      // true if more pages
 * ```
 */
export class PrismaPaginator<TDomain> {
  constructor(
    private readonly model: PrismaModelDelegate,
    private readonly mapper: PrismaMapper<TDomain>,
  ) {}

  /**
   * Execute a paginated query.
   *
   * @param pageRequest - Page number (1-based), page size, and optional sorting.
   * @param where       - Optional Prisma `where` filter applied to both the
   *                      data query and the count query.
   */
  async findPage(
    pageRequest: PageRequest,
    where?: Record<string, unknown>,
  ): Promise<Page<TDomain>> {
    const { page, pageSize, sort } = pageRequest;
    const skip = (page - 1) * pageSize;
    const orderBy = this.buildOrderBy(sort);

    const queryArgs: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, unknown>[];
      skip: number;
      take: number;
    } = { skip, take: pageSize };

    if (where !== undefined) {
      queryArgs.where = where;
    }
    if (orderBy !== undefined) {
      queryArgs.orderBy = orderBy;
    }

    const countArgs: { where?: Record<string, unknown> } = {};
    if (where !== undefined) {
      countArgs.where = where;
    }

    const [records, total] = await Promise.all([
      this.model.findMany(queryArgs),
      this.model.count(countArgs),
    ]);

    const items = records.map((r) => this.mapper.toDomain(r));

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
   * Convert PageRequest Sort array to Prisma orderBy format.
   */
  private buildOrderBy(sort?: Sort[]): Record<string, 'asc' | 'desc'>[] | undefined {
    if (sort === undefined || sort.length === 0) return undefined;
    return sort.map((s) => ({ [s.field]: s.direction }));
  }
}
