/**
 * Pagination support for MongoDB collections.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- MongoDB framework boundary: collection methods return any */
/* eslint-disable @typescript-eslint/no-unsafe-call -- MongoDB framework boundary: collection method calls */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- MongoDB framework boundary: Sort fields inferred as any through PageRequest */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- MongoDB framework boundary: Sort.field / Sort.direction inferred as any */
import type { Page, PageRequest, Sort } from '@acme/persistence';
import type { MongoMapper } from './MongoMapper';
import type { MongoCollectionLike } from './MongoRepository';

/**
 * Helper class for paginated queries using a MongoDB collection.
 *
 * Uses the native cursor's `skip` / `limit` / `sort` API and runs
 * `find` and `countDocuments` in parallel for efficiency.
 *
 * @example
 * ```typescript
 * const paginator = new MongoPaginator(
 *   db.collection('users') as unknown as MongoCollectionLike,
 *   new UserMongoMapper(),
 * );
 *
 * const page = await paginator.findPage(
 *   { page: 1, pageSize: 20, sort: [{ field: 'name', direction: 'asc' }] },
 *   { deletedAt: null },   // optional MongoDB filter
 * );
 *
 * console.log(page.items.length); // Up to 20 users
 * console.log(page.total);        // Total matching count
 * console.log(page.hasNext);      // true if more pages exist
 * ```
 */
export class MongoPaginator<TDomain> {
  constructor(
    private readonly collection: MongoCollectionLike,
    private readonly mapper: MongoMapper<TDomain>,
  ) {}

  /**
   * Execute a paginated query.
   *
   * @param pageRequest - Page number (1-based), page size, and optional sorting.
   * @param filter      - Optional MongoDB filter applied to both the data query
   *                      and the count query.
   */
  async findPage(
    pageRequest: PageRequest,
    filter?: Record<string, unknown>,
  ): Promise<Page<TDomain>> {
    const { page, pageSize, sort } = pageRequest;
    const skip = (page - 1) * pageSize;
    const queryFilter: Record<string, unknown> = filter ?? {};

    const cursor = this.collection.find(queryFilter);

    if (sort !== undefined && sort.length > 0) {
      cursor.sort(this.buildSort(sort));
    }

    cursor.skip(skip).limit(pageSize);

    const [docs, total] = await Promise.all([
      cursor.toArray(),
      this.collection.countDocuments(queryFilter),
    ]);

    const items = docs.map((d) => this.mapper.toDomain(d));

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
   * Convert PageRequest Sort array to MongoDB sort document.
   * Maps `'asc'` → `1` and `'desc'` → `-1`.
   */
  private buildSort(sort: Sort[]): Record<string, 1 | -1> {
    const result: Record<string, 1 | -1> = {};
    for (const s of sort) {
      result[s.field] = s.direction === 'asc' ? 1 : -1;
    }
    return result;
  }
}
