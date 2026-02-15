/**
 * Marker interface for queries.
 * Queries represent intent to read data without side effects.
 */
export interface Query<TResult = unknown> {
  readonly _brand?: 'Query';
  readonly _result?: TResult;
}
