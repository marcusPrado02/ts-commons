import type {
  ServiceCall,
  AggregationResult,
  BffResponse,
  ClientType,
  ResponseShaper,
} from './types.js';
import { ServiceAggregator } from './ServiceAggregator.js';
import { ResponseShaperRegistry } from './ResponseShaper.js';

/**
 * REST-oriented BFF handler.
 *
 * Aggregates zero or more backend {@link ServiceCall}s in parallel and
 * optionally shapes the resulting map for a specific {@link ClientType}.
 *
 * @example
 * const bff = new RestBff()
 *   .registerShaper(new FunctionResponseShaper('mobile', trim));
 *
 * const response = await bff.handle(
 *   [{ name: 'user', fetch: () => getUser(id) }],
 *   'mobile',
 * );
 */
export class RestBff<TData = Record<string, unknown>> {
  private readonly aggregator = new ServiceAggregator();
  private readonly shapers = new ResponseShaperRegistry<
    Record<string, AggregationResult<unknown>>,
    TData
  >();

  /**
   * Register a {@link ResponseShaper} for a specific client type.
   * Returns `this` for a fluent API.
   */
  registerShaper(shaper: ResponseShaper<Record<string, AggregationResult<unknown>>, TData>): this {
    this.shapers.register(shaper);
    return this;
  }

  /**
   * Aggregate `calls` in parallel, then optionally shape the result map for
   * `clientType`.  Each result entry is keyed by the call's `name`.
   *
   * The `statusCode` is `200` when all calls succeed or `207` (Multi-Status)
   * when at least one fails.
   */
  async handle(
    calls: readonly ServiceCall<unknown>[],
    clientType: ClientType,
  ): Promise<BffResponse<TData | Record<string, AggregationResult<unknown>>>> {
    const results = await this.aggregator.aggregate(calls);

    const resultMap: Record<string, AggregationResult<unknown>> = {};
    for (const r of results) {
      resultMap[r.name] = r;
    }

    const allSucceeded = results.every((r) => r.succeeded);
    const statusCode = allSucceeded ? 200 : 207;

    const data = this.shapers.shape(clientType, resultMap);

    return {
      data,
      statusCode,
      clientType,
      respondedAt: new Date(),
    };
  }
}
