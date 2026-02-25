import type { DlqEntry, ReprocessResult } from './types.js';

/**
 * In-memory Dead Letter Queue that captures records which could not be
 * processed successfully.
 *
 * Failed entries can be inspected, cleared, or reprocessed with a new handler.
 */
export class DeadLetterQueue<T> {
  private readonly store: DlqEntry<T>[] = [];

  /**
   * Add a failed item to the queue.
   */
  enqueue(data: T, error: Error): void {
    this.store.push({ data, error, enqueuedAt: new Date(), retries: 0 });
  }

  /**
   * Remove and return the oldest entry, or `undefined` when the queue is empty.
   */
  dequeue(): DlqEntry<T> | undefined {
    return this.store.shift();
  }

  /** Number of entries currently in the queue. */
  size(): number {
    return this.store.length;
  }

  /** Remove all entries. */
  clear(): void {
    this.store.length = 0;
  }

  /** Deep copy of all current entries. */
  getEntries(): DlqEntry<T>[] {
    return structuredClone(this.store);
  }

  /**
   * Attempt to reprocess every queued entry using `handler`.
   *
   * Entries that succeed are removed.  Entries that fail are re-queued with
   * their `retries` counter incremented.
   */
  async reprocess(handler: (data: T) => Promise<void>): Promise<ReprocessResult> {
    const pending = this.store.splice(0);
    let succeeded = 0;
    let failed = 0;

    for (const entry of pending) {
      try {
        await handler(entry.data);
        succeeded++;
      } catch (err) {
        this.store.push({
          data: entry.data,
          error: err instanceof Error ? err : new Error(String(err)),
          enqueuedAt: entry.enqueuedAt,
          retries: entry.retries + 1,
        });
        failed++;
      }
    }

    return { succeeded, failed };
  }
}
