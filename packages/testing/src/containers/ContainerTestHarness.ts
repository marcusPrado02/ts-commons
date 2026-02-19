import type { TestContainerPort } from './TestContainerPort';

/**
 * Manages the lifecycle of a set of named test containers.
 *
 * Typical usage within a Vitest suite:
 * ```typescript
 * const harness = new ContainerTestHarness();
 * harness.register('pg', myPostgresContainer);
 *
 * beforeAll(() => harness.setupAll());
 * afterAll(() => harness.teardownAll());
 *
 * it('...', () => {
 *   const pg = harness.getContainer<PostgresConnectionInfo>('pg');
 *   // pg.getConnectionInfo().url
 * });
 * ```
 */
export class ContainerTestHarness {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly containers = new Map<string, TestContainerPort<any>>();
  private started = false;

  /**
   * Registers a container under a logical name.
   * Returns `this` for fluent chaining.
   */
  register<T>(name: string, container: TestContainerPort<T>): this {
    this.containers.set(name, container);
    return this;
  }

  /**
   * Starts all registered containers in parallel.
   * Call once in `beforeAll`.
   */
  async setupAll(): Promise<void> {
    await Promise.all(
      Array.from(this.containers.values()).map((c) => c.start()),
    );
    this.started = true;
  }

  /**
   * Stops all registered containers in parallel.
   * Call once in `afterAll`.
   */
  async teardownAll(): Promise<void> {
    await Promise.all(
      Array.from(this.containers.values()).map((c) => c.stop()),
    );
    this.started = false;
  }

  /**
   * Retrieves a previously registered container by name.
   * @throws if no container is registered under `name`.
   */
  getContainer<T>(name: string): TestContainerPort<T> {
    const container = this.containers.get(name);
    if (container === undefined) {
      throw new Error(`No container registered under name "${name}"`);
    }
    return container as TestContainerPort<T>;
  }

  /** Returns `true` after `setupAll()` and before `teardownAll()`. */
  isStarted(): boolean {
    return this.started;
  }

  /** Returns the number of registered containers. */
  size(): number {
    return this.containers.size;
  }
}
