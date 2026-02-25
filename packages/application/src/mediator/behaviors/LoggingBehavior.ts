import type { PipelineBehavior, MediatorLogEntry } from '../types.js';

/**
 * Pipeline behavior that records timing and success/failure for every
 * request that passes through the mediator.
 *
 * Ordered at 10 so it wraps all other default behaviors.
 */
export class LoggingBehavior<TRequest = unknown, TResponse = unknown> implements PipelineBehavior<
  TRequest,
  TResponse
> {
  readonly order = 10;

  private readonly log: MediatorLogEntry[] = [];

  async handle(request: TRequest, next: () => Promise<TResponse>): Promise<TResponse> {
    const requestType = (request as object).constructor.name;
    const start = Date.now();
    try {
      const result = await next();
      this.log.push({ requestType, durationMs: Date.now() - start, success: true });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.log.push({ requestType, durationMs: Date.now() - start, success: false, error });
      throw err;
    }
  }

  /** All recorded log entries (deep copies). */
  getEntries(): readonly MediatorLogEntry[] {
    return structuredClone(this.log);
  }

  /** Clear recorded entries. */
  clear(): void {
    this.log.length = 0;
  }
}
