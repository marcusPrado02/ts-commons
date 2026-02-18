/**
 * Pure helper functions for the soft-delete pattern in MongoDB.
 *
 * Add a `deletedAt` field to your document schema and use these utilities
 * instead of hard-deleting documents.  In MongoDB, a document with
 * `deletedAt: null` (or a missing field) is treated as active.
 *
 * @example
 * ```typescript
 * // Scope a query to active (non-deleted) documents
 * const filter = withActivesOnly({ organizationId: 'org-1' });
 * // → { organizationId: 'org-1', deletedAt: null }
 *
 * // Soft-delete a document
 * await collection.updateOne({ _id: id }, { $set: softDeleteData() });
 *
 * // Restore a soft-deleted document
 * await collection.updateOne({ _id: id }, { $set: restoreData() });
 * ```
 */

/** Document interface for collections that support soft delete. */
export interface SoftDeletable {
  readonly deletedAt?: Date | null;
}

/**
 * Merge a filter with `{ deletedAt: null }` so only active documents are returned.
 *
 * @param filter - Optional base filter to merge into.
 */
export function withActivesOnly(
  filter?: Record<string, unknown>,
): Record<string, unknown> {
  return { ...(filter ?? {}), deletedAt: null };
}

/**
 * Return the update payload for soft-deleting a document.
 * Designed for use with `$set` in `updateOne` / `updateMany`.
 */
export function softDeleteData(): Record<string, unknown> {
  return { deletedAt: new Date() };
}

/**
 * Return the update payload for restoring a soft-deleted document.
 * Designed for use with `$set` in `updateOne` / `updateMany`.
 */
export function restoreData(): Record<string, unknown> {
  return { deletedAt: null };
}
