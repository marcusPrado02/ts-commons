import type { ShutdownHandler, ShutdownResult } from './types';

export class GracefulShutdown {
  private readonly handlers: ShutdownHandler[] = [];
  private shuttingDown = false;
  private readonly timeoutMs: number;

  constructor(timeoutMs = 10_000) {
    this.timeoutMs = timeoutMs;
  }

  register(name: string, fn: () => Promise<void>): void {
    this.handlers.push({ name, fn });
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  handlerCount(): number {
    return this.handlers.length;
  }

  names(): string[] {
    return this.handlers.map((h) => h.name);
  }

  async shutdown(): Promise<ShutdownResult> {
    if (this.shuttingDown) {
      return { success: true, errors: [] };
    }
    this.shuttingDown = true;
    const errors: string[] = [];
    for (const handler of [...this.handlers].reverse()) {
      await this.runWithTimeout(handler, errors);
    }
    return { success: errors.length === 0, errors };
  }

  listen(signals: ReadonlyArray<NodeJS.Signals> = ['SIGTERM', 'SIGINT']): void {
    for (const signal of signals) {
      process.on(signal, () => {
        void this.shutdown();
      });
    }
  }

  private async runWithTimeout(handler: ShutdownHandler, errors: string[]): Promise<void> {
    let timerId: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        handler.fn(),
        new Promise<never>((_, reject) => {
          timerId = setTimeout(() => {
            reject(new Error(`Handler '${handler.name}' timed out after ${this.timeoutMs}ms`));
          }, this.timeoutMs);
        }),
      ]);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    } finally {
      clearTimeout(timerId);
    }
  }
}
