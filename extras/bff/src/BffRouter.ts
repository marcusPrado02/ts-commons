import type { ClientType } from './types.js';

type AnyHandler = (request: unknown) => Promise<unknown>;

/**
 * Routes incoming requests to the appropriate BFF handler based on the
 * {@link ClientType}.
 *
 * @example
 * const router = new BffRouter<UserRequest, UserResponse>()
 *   .register('web',    webBffHandler)
 *   .register('mobile', mobileBffHandler);
 *
 * const result = await router.route(request, 'mobile');
 */
export class BffRouter<TRequest = unknown, TResponse = unknown> {
  private readonly handlers = new Map<ClientType, (req: TRequest) => Promise<TResponse>>();

  /**
   * Register a handler for a given `clientType`.
   * If a handler is already registered for that type it is replaced.
   * Returns `this` for a fluent API.
   */
  register(clientType: ClientType, handler: (request: TRequest) => Promise<TResponse>): this {
    this.handlers.set(clientType, handler as AnyHandler as (req: TRequest) => Promise<TResponse>);
    return this;
  }

  /**
   * Dispatch `request` to the handler registered for `clientType`.
   * @throws {Error} when no handler is registered for `clientType`.
   */
  async route(request: TRequest, clientType: ClientType): Promise<TResponse> {
    const handler = this.handlers.get(clientType);
    if (handler === undefined) {
      throw new Error(`No BFF handler registered for client type: "${clientType}"`);
    }
    return handler(request);
  }

  /** Returns `true` if a handler is registered for `clientType`. */
  has(clientType: ClientType): boolean {
    return this.handlers.has(clientType);
  }

  /** Number of registered handlers. */
  size(): number {
    return this.handlers.size;
  }
}
