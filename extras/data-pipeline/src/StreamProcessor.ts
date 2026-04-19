import type { StreamResult } from './types.js';

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * Processes records from an async iterable one-by-one.
 *
 * Each record is passed to `handler`, which may return a processed value or
 * `undefined` to skip the record.  Failures are captured rather than
 * propagated.
 */
export class StreamProcessor<T = unknown> {
  /**
   * Consume `source`, calling `handler` for every item.
   *
   * @param onError  Optional callback invoked for each failed item.
   */
  async process(
    source: AsyncIterable<T>,
    handler: (record: T) => Promise<T | undefined>,
    onError?: (error: Error, record: T) => void,
  ): Promise<StreamResult> {
    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for await (const item of source) {
      try {
        const result = await handler(item);
        if (result === undefined) {
          skipped++;
        } else {
          processed++;
        }
      } catch (err) {
        failed++;
        if (onError !== undefined) {
          onError(toError(err), item);
        }
      }
    }

    return { processed, skipped, failed };
  }
}
