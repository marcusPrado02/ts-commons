/**
 * Prisma ORM adapter for Clean Architecture repositories.
 *
 * This package provides Prisma implementations of the repository pattern,
 * unit of work, pagination, and soft-delete utilities, all independent of
 * generated Prisma types so they work in any project.
 *
 * @example
 * ```typescript
 * import {
 *   PrismaRepository,
 *   PrismaUnitOfWork,
 *   PrismaPaginator,
 *   withActivesOnly,
 *   softDeleteData,
 * } from '@acme/persistence-prisma';
 * ```
 */

export { PrismaRepository } from './PrismaRepository';
export type { PrismaModelDelegate } from './PrismaRepository';

export { PrismaUnitOfWork } from './PrismaUnitOfWork';
export type { PrismaClientLike } from './PrismaUnitOfWork';

export { PrismaPaginator } from './PrismaPaginator';

export type { PrismaMapper } from './PrismaMapper';

export { withActivesOnly, softDeleteData, restoreData } from './PrismaSoftDelete';
export type { SoftDeletable } from './PrismaSoftDelete';
