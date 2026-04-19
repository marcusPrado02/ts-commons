import type { DataDestination, DataRecord } from './types.js';

/**
 * In-memory {@link DataDestination} that accumulates written records.
 *
 * Primarily intended for testing pipelines without a real storage back-end.
 */
export class InMemoryDestination implements DataDestination {
  private readonly written: DataRecord[] = [];

  async write(records: readonly DataRecord[]): Promise<void> {
    await Promise.resolve();
    for (const record of records) {
      this.written.push(record);
    }
  }

  /** All records written so far (deep copy). */
  getRecords(): DataRecord[] {
    return structuredClone(this.written);
  }

  /** Total number of written records. */
  count(): number {
    return this.written.length;
  }

  /** Discard all written records. */
  clear(): void {
    this.written.length = 0;
  }
}
