/**
 * Mapper interface for converting between domain and Prisma persistence models.
 *
 * @template TDomain - The domain entity type
 * @template TPersistence - The Prisma record type (defaults to Record<string, unknown>)
 *
 * @example
 * ```typescript
 * class UserMapper implements PrismaMapper<User> {
 *   toPersistence(domain: User): Record<string, unknown> {
 *     return {
 *       id: domain.id.value,
 *       name: domain.name,
 *       email: domain.email,
 *       createdAt: domain.createdAt,
 *     };
 *   }
 *
 *   toDomain(record: Record<string, unknown>): User {
 *     return new User(
 *       new UserId(record['id'] as string),
 *       record['name'] as string,
 *       record['email'] as string,
 *     );
 *   }
 * }
 * ```
 */
export interface PrismaMapper<
  TDomain,
  TPersistence extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
   * Convert a domain entity to a Prisma-compatible plain object
   */
  toPersistence(domain: TDomain): TPersistence;

  /**
   * Convert a Prisma record to a domain entity
   */
  toDomain(record: TPersistence): TDomain;
}
