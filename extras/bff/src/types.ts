/**
 * Core types for the Backend-for-Frontend (BFF) pattern.
 */

/**
 * The type of client consuming this BFF endpoint.
 * Different clients may receive differently shaped responses.
 */
export type ClientType = 'web' | 'mobile' | 'desktop' | 'public-api';

/**
 * A typed response envelope produced by a BFF handler.
 */
export interface BffResponse<T> {
  readonly data: T;
  readonly statusCode: number;
  readonly clientType: ClientType;
  readonly respondedAt: Date;
}

/**
 * A single named backend service call.
 */
export interface ServiceCall<T> {
  readonly name: string;
  fetch(): Promise<T>;
}

/**
 * The outcome of one entry in a parallel or sequential aggregation.
 */
export interface AggregationResult<T> {
  readonly name: string;
  readonly data: T | undefined;
  readonly error: Error | undefined;
  readonly succeeded: boolean;
}

/**
 * Transforms a backend payload `TFrom` into the client-specific shape `TTo`.
 */
export interface ResponseShaper<TFrom, TTo> {
  readonly clientType: ClientType;
  shape(data: TFrom): TTo;
}

/**
 * A single GraphQL-style field resolver (name + async resolver function).
 */
export interface GraphQlField<T = unknown> {
  readonly name: string;
  resolve(): Promise<T>;
}

/**
 * The result of a `GraphQlBff.execute()` call.
 */
export interface GraphQlResult {
  readonly data: Record<string, unknown>;
  readonly errors: readonly GraphQlFieldError[];
}

/**
 * A per-field error entry inside a {@link GraphQlResult}.
 */
export interface GraphQlFieldError {
  readonly field: string;
  readonly message: string;
}
