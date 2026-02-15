import type { Result } from '@acme/kernel';
import type { Query } from './Query';

/**
 * Handler for executing queries.
 */
export interface QueryHandler<TQuery extends Query<TResult>, TResult = unknown, TError = Error> {
  handle(query: TQuery): Promise<Result<TResult, TError>>;
}
