/**
 * Abstract base class that encodes the expected response type for a request.
 * Extend this class in every command/query so that {@link Mediator.send}
 * can infer the return type without explicit generics.
 *
 * The `_responseType` property is a phantom brand: it exists only at the
 * type level (`declare`) and has zero runtime cost.
 *
 * @typeParam TResponse  The expected response type for this request.
 *
 * @example
 * ```ts
 * class GetUserQuery extends MediatorRequest<User> {
 *   constructor(public readonly userId: string) { super(); }
 * }
 * const user = await mediator.send(new GetUserQuery('123')); // user: User
 * ```
 */
export abstract class MediatorRequest<TResponse = void> {
  /** @internal Phantom brand — never set at runtime. Carries the response type. */
  declare readonly _responseType: TResponse;
}

/**
 * Handles a single request type and returns a typed response.
 */
export interface RequestHandler<TRequest, TResponse> {
  handle(request: TRequest): Promise<TResponse>;
}

/**
 * Cross-cutting behavior that wraps request dispatch.
 * Behaviors are chained in ascending `order` (lower runs first).
 */
export interface PipelineBehavior<TRequest = unknown, TResponse = unknown> {
  /**
   * Execution order within the pipeline. Lower numbers run first.
   * Defaults to 0 when not provided.
   */
  readonly order?: number;
  handle(request: TRequest, next: () => Promise<TResponse>): Promise<TResponse>;
}

/**
 * Runs logic before the request reaches the handler.
 * Convenience specialisation — implement and add as a PipelineBehavior.
 */
export interface PreProcessor<TRequest = unknown> {
  process(request: TRequest): Promise<void>;
}

/**
 * Runs logic after the handler returns.
 * Convenience specialisation — implement and add as a PipelineBehavior.
 */
export interface PostProcessor<TRequest = unknown, TResponse = unknown> {
  process(request: TRequest, response: TResponse): Promise<void>;
}

/**
 * Log entry produced by LoggingBehavior.
 */
export interface MediatorLogEntry {
  readonly requestType: string;
  readonly durationMs: number;
  readonly success: boolean;
  readonly error?: string;
}

/**
 * Cache entry used by CachingBehavior.
 */
export interface CacheEntry<T = unknown> {
  readonly value: T;
  readonly cachedAt: Date;
  readonly ttlMs?: number;
}
