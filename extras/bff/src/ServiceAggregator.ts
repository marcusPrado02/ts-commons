import type { ServiceCall, AggregationResult } from './types.js';

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * Aggregates results from multiple {@link ServiceCall} instances.
 *
 * - **parallel** (default): all calls are fired concurrently; individual
 *   failures are captured as {@link AggregationResult.error} without
 *   rejecting the entire aggregation.
 * - **strict parallel**: same as above but throws on the first failure.
 * - **sequential**: calls are executed one-by-one in order; individual
 *   failures are still captured without aborting the sequence.
 */
export class ServiceAggregator {
  /**
   * Run all `calls` in parallel.  Failures are captured per-result rather
   * than propagated.
   */
  async aggregate<T>(calls: readonly ServiceCall<T>[]): Promise<AggregationResult<T>[]> {
    return Promise.all(
      calls.map(async (call): Promise<AggregationResult<T>> => {
        try {
          const data = await call.fetch();
          return { name: call.name, data, error: undefined, succeeded: true };
        } catch (err) {
          return { name: call.name, data: undefined, error: toError(err), succeeded: false };
        }
      }),
    );
  }

  /**
   * Run all `calls` in parallel.  The first failure rejects the entire
   * aggregation (equivalent to `Promise.all` semantics).
   */
  async aggregateStrict<T>(calls: readonly ServiceCall<T>[]): Promise<T[]> {
    return Promise.all(calls.map((c) => c.fetch()));
  }

  /**
   * Run `calls` one at a time in order.  Failures are captured per-result
   * and do not abort the sequence.
   */
  async aggregateSequential<T>(calls: readonly ServiceCall<T>[]): Promise<AggregationResult<T>[]> {
    const results: AggregationResult<T>[] = [];
    for (const call of calls) {
      try {
        const data = await call.fetch();
        results.push({ name: call.name, data, error: undefined, succeeded: true });
      } catch (err) {
        results.push({ name: call.name, data: undefined, error: toError(err), succeeded: false });
      }
    }
    return results;
  }
}
