import type { ConfigLoader } from './ConfigLoader';

type ChangeListener<T> = (config: T) => void;

/**
 * Wraps a {@link ConfigLoader} with the ability to re-load configuration on
 * demand and notify subscribers of changes.
 *
 * ```ts
 * const hot = new HotReloadConfigLoader(loader);
 * const config = await hot.start();
 *
 * hot.onChange(next => console.log('Config changed', next));
 * await hot.reload(); // re-reads all sources + re-validates
 * ```
 */
export class HotReloadConfigLoader<T> {
  private current: T | undefined;
  private readonly listeners: Set<ChangeListener<T>> = new Set();

  constructor(private readonly inner: ConfigLoader<T>) {}

  /**
   * Loads configuration for the first time and stores the result.
   * Must be called before {@link get}.
   */
  async start(): Promise<T> {
    this.current = await this.inner.load();
    return this.current;
  }

  /**
   * Re-loads configuration from all sources. On success the stored value is
   * updated and all registered listeners are notified synchronously.
   */
  async reload(): Promise<T> {
    const next = await this.inner.load();
    this.current = next;
    for (const listener of this.listeners) {
      listener(next);
    }
    return next;
  }

  /**
   * Registers a callback invoked after every successful {@link reload}.
   * Returns an unsubscribe function.
   */
  onChange(fn: ChangeListener<T>): () => void {
    this.listeners.add(fn);
    return (): void => {
      this.listeners.delete(fn);
    };
  }

  /**
   * Returns the last successfully loaded configuration.
   * Throws if {@link start} has not been called yet.
   */
  get(): T {
    if (this.current === undefined) {
      throw new Error('HotReloadConfigLoader has not been started — call start() first.');
    }
    return this.current;
  }
}
