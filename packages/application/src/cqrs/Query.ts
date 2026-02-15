/**
 * Marker interface for queries.
 * Queries represent intent to read data without side effects.
 */
export interface Query<TResult = unknown> {
  readonly _brand?: 'Query';
  readonly _result?: TResult;
}

/**
 * Base class for queries to ensure proper typing
 */
export abstract class BaseQuery<TResult = unknown> implements Query<TResult> {
  readonly _brand?: 'Query';
  readonly _result?: TResult;
}
