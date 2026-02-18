/**
 * Soft delete utilities for Prisma repositories.
 *
 * These pure functions build Prisma `where` clauses and `data` objects that
 * implement the soft-delete pattern (a `deletedAt` timestamp column).
 *
 * @example
 * ```typescript
 * // Filter active records
 * const users = await prisma.user.findMany({
 *   where: withActivesOnly({ organizationId: orgId }),
 * });
 *
 * // Soft-delete a record
 * await prisma.user.update({
 *   where: { id: userId },
 *   data: softDeleteData(),
 * });
 *
 * // Restore a soft-deleted record
 * await prisma.user.update({
 *   where: { id: userId },
 *   data: restoreData(),
 * });
 * ```
 */

/**
 * Marker interface for domain types that support soft-deletion.
 */
export interface SoftDeletable {
  readonly deletedAt?: Date | null;
}

/**
 * Extend (or create) a Prisma `where` filter so that only non-deleted
 * records are returned (`deletedAt IS NULL`).
 *
 * @param where - Optional existing where clause to extend.
 */
export function withActivesOnly(where?: Record<string, unknown>): Record<string, unknown> {
  return {
    ...(where ?? {}),
    deletedAt: null,
  };
}

/**
 * Build a Prisma `data` object that sets `deletedAt` to the current timestamp,
 * effectively marking a record as soft-deleted.
 */
export function softDeleteData(): Record<string, unknown> {
  return { deletedAt: new Date() };
}

/**
 * Build a Prisma `data` object that clears `deletedAt`, restoring a
 * previously soft-deleted record.
 */
export function restoreData(): Record<string, unknown> {
  return { deletedAt: null };
}
