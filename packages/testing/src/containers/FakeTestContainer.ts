import type { TestContainerPort } from './TestContainerPort';

/**
 * In-memory fake implementation of {@link TestContainerPort}.
 *
 * Fully controllable in unit tests — no Docker required.
 *
 * @example
 * ```typescript
 * const fake = new FakeTestContainer({ host: 'localhost', port: 5432, ... });
 * await fake.start();
 * expect(fake.isRunning()).toBe(true);
 * ```
 */
export class FakeTestContainer<TConnectionInfo> implements TestContainerPort<TConnectionInfo> {
  private running = false;
  private failureError: Error | undefined;

  constructor(private readonly connectionInfo: TConnectionInfo) {}

  start(): Promise<void> {
    if (this.failureError !== undefined) {
      return Promise.reject(this.failureError);
    }
    this.running = true;
    return Promise.resolve();
  }

  stop(): Promise<void> {
    this.running = false;
    return Promise.resolve();
  }

  getConnectionInfo(): TConnectionInfo {
    if (!this.running) {
      throw new Error('Container is not running — call start() first');
    }
    return this.connectionInfo;
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Makes the next `start()` call reject with the provided error.
   * Useful for testing failure-recovery paths.
   */
  simulateFailure(error: Error): void {
    this.failureError = error;
  }

  /** Clears a previously configured simulated failure. */
  clearFailure(): void {
    this.failureError = undefined;
  }
}
