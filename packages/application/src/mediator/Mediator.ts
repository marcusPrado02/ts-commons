import type { MediatorRequest, RequestHandler, PipelineBehavior } from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyConstructor = new (...args: any[]) => unknown;

/**
 * Mediator that dispatches requests through an ordered pipeline of behaviors
 * before delivering them to the registered handler.
 */
export class Mediator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly handlers = new Map<string, RequestHandler<any, any>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly behaviors: PipelineBehavior<any, any>[] = [];

  /**
   * Register a handler for a request type.
   */
  register<TRequest, TResponse>(
    requestType: AnyConstructor,
    handler: RequestHandler<TRequest, TResponse>,
  ): void {
    this.handlers.set(requestType.name, handler);
  }

  /**
   * Add a cross-cutting pipeline behavior.
   * Behaviors with lower `order` run first (default order is 0).
   */
  addBehavior<TRequest, TResponse>(behavior: PipelineBehavior<TRequest, TResponse>): void {
    this.behaviors.push(behavior);
    this.behaviors.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  /**
   * Dispatch a request through the pipeline and to its handler.
   * Throws if no handler is registered for the request type.
   */
  async send<TResponse>(request: MediatorRequest<TResponse>): Promise<TResponse> {
    const key = request.constructor.name;
    const handler = this.handlers.get(key) as RequestHandler<unknown, TResponse> | undefined;

    if (handler === undefined) {
      throw new Error(`No handler registered for request: ${key}`);
    }

    return this.runPipeline(request, handler, 0);
  }

  private runPipeline<TResponse>(
    request: unknown,
    handler: RequestHandler<unknown, TResponse>,
    index: number,
  ): Promise<TResponse> {
    if (index >= this.behaviors.length) {
      return handler.handle(request);
    }

    const behavior = this.behaviors[index]!;
    return behavior.handle(request, () =>
      this.runPipeline(request, handler, index + 1),
    ) as Promise<TResponse>;
  }

  /** Number of registered request handlers. */
  handlerCount(): number {
    return this.handlers.size;
  }

  /** Number of registered pipeline behaviors. */
  behaviorCount(): number {
    return this.behaviors.length;
  }
}
