import type { Result } from '@acme/kernel';
import type { Query } from './Query';
import type { QueryHandler } from './QueryHandler';

/**
 * Query constructor type that can be concrete or abstract
 */
export type QueryConstructor<TQuery extends Query<any> = Query<any>> =
  | (new (...args: any[]) => TQuery)
  | (abstract new (...args: any[]) => TQuery);

/**
 * Query bus for dispatching queries to handlers.
 */
export interface QueryBus {
  dispatch<TQuery extends Query<TResult>, TResult = unknown, TError = Error>(
    query: TQuery,
  ): Promise<Result<TResult, TError>>;

  register<TQuery extends Query<TResult>, TResult = unknown, TError = Error>(
    queryType: QueryConstructor<TQuery>,
    handler: QueryHandler<TQuery, TResult, TError>,
  ): void;
}

/**
 * Simple in-memory query bus implementation.
 */
export class InMemoryQueryBus implements QueryBus {
  private readonly handlers = new Map<string, QueryHandler<Query<unknown>, unknown, Error>>();

  register<TQuery extends Query<TResult>, TResult = unknown, TError = Error>(
    queryType: QueryConstructor<TQuery>,
    handler: QueryHandler<TQuery, TResult, TError>,
  ): void {
    this.handlers.set(queryType.name, handler as QueryHandler<Query<unknown>, unknown, Error>);
  }

  async dispatch<TQuery extends Query<TResult>, TResult = unknown, TError = Error>(
    query: TQuery,
  ): Promise<Result<TResult, TError>> {
    const handler = this.handlers.get(query.constructor.name);
    if (!handler) {
      throw new Error(`No handler registered for query: ${query.constructor.name}`);
    }
    return handler.handle(query) as Promise<Result<TResult, TError>>;
  }
}
