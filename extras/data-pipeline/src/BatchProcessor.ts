import type { BatchOptions, BatchResult } from './types.js';

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * Processes records from an async iterable in fixed-size batches.
 *
 * Individual batch failures are captured (and optionally forwarded to
 * `options.onError`) rather than aborting the entire run.
 */
export class BatchProcessor<T = unknown> {
  /**
   * Consume `source`, grouping items into batches of `options.batchSize`,
   * then call `handler` for each batch.
   */
  async process(
    source: AsyncIterable<T>,
    handler: (batch: readonly T[]) => Promise<void>,
    options: BatchOptions<T> = { batchSize: 100 },
  ): Promise<BatchResult> {
    const { batchSize } = options;
    let processed = 0;
    let batches = 0;
    let failed = 0;
    let batch: T[] = [];

    for await (const item of source) {
      batch.push(item);
      if (batch.length >= batchSize) {
        const stats = await this.flush(batch, handler, options.onError);
        processed += stats.processed;
        failed += stats.failed;
        if (stats.processed > 0) batches++;
        batch = [];
      }
    }

    if (batch.length > 0) {
      const stats = await this.flush(batch, handler, options.onError);
      processed += stats.processed;
      failed += stats.failed;
      if (stats.processed > 0) batches++;
    }

    return { processed, batches, failed };
  }

  private async flush(
    batch: T[],
    handler: (batch: readonly T[]) => Promise<void>,
    onError: BatchOptions<T>['onError'],
  ): Promise<{ processed: number; failed: number }> {
    try {
      await handler(batch);
      return { processed: batch.length, failed: 0 };
    } catch (err) {
      if (onError !== undefined) {
        onError(toError(err), batch);
      }
      return { processed: 0, failed: batch.length };
    }
  }
}
