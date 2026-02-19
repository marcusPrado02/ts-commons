import type { ConfigSource } from './ConfigSource';

/**
 * A config source that fetches values from a remote endpoint.
 * Extend this interface to add refresh / watch capabilities.
 */
export interface RemoteConfigSource extends ConfigSource {
  /**
   * Optional: refresh the cached values from the remote store.
   * Implementations may be no-ops if the load call is always live.
   */
  refresh?(): Promise<void>;
}

/**
 * In-memory implementation of {@link RemoteConfigSource} — useful for
 * testing or as a seeded override source.
 *
 * ```ts
 * const remote = new InMemoryRemoteConfigSource({ API_KEY: 'secret' });
 * remote.set('FEATURE_FLAG', 'true');
 * const loader = new ConfigLoader(schema, [remote, new ProcessEnvSource()]);
 * ```
 */
export class InMemoryRemoteConfigSource implements RemoteConfigSource {
  private readonly store: Record<string, string | undefined>;

  constructor(initial: Record<string, string | undefined> = {}) {
    this.store = { ...initial };
  }

  load(): Promise<Record<string, string | undefined>> {
    return Promise.resolve({ ...this.store });
  }

  refresh(): Promise<void> {
    return Promise.resolve();
  }

  /** Upsert a key. */
  set(key: string, value: string): void {
    this.store[key] = value;
  }

  /** Remove a key. */
  delete(key: string): void {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this.store[key];
  }
}
