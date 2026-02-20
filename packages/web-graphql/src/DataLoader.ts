// ---------------------------------------------------------------------------
// Batch load function
// ---------------------------------------------------------------------------

export type BatchLoadFn<K, V> = (keys: readonly K[]) => Promise<ReadonlyArray<V | Error>>;

// ---------------------------------------------------------------------------
// Internal queue entry
// ---------------------------------------------------------------------------

interface QueueEntry<K, V> {
  readonly key: K;
  readonly resolve: (value: V) => void;
  readonly reject: (reason: unknown) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveEntry<K, V>(entry: QueueEntry<K, V>, result: V | Error, cache: Map<K, V>): void {
  if (result instanceof Error) {
    entry.reject(result);
  } else {
    cache.set(entry.key, result);
    entry.resolve(result);
  }
}

function dispatchResults<K, V>(
  batch: readonly QueueEntry<K, V>[],
  results: ReadonlyArray<V | Error>,
  cache: Map<K, V>,
): void {
  for (let i = 0; i < batch.length; i++) {
    const entry = batch[i];
    const result = results[i];
    if (entry === undefined || result === undefined) continue;
    resolveEntry(entry, result, cache);
  }
}

// ---------------------------------------------------------------------------
// DataLoader
// ---------------------------------------------------------------------------

/**
 * Batches multiple individual `load` calls into a single `BatchLoadFn`
 * invocation per microtask tick, with an optional result cache.
 *
 * Keys must be `string | number` to be usable as `Map` keys.
 *
 * @example
 * ```ts
 * const loader = new DataLoader<string, User>(async (ids) => fetchUsers(ids));
 * const user = await loader.load('u1');
 * ```
 */
export class DataLoader<K extends string | number, V> {
  private readonly cache = new Map<K, V>();
  private queue: Array<QueueEntry<K, V>> = [];
  private scheduled = false;

  constructor(private readonly batchFn: BatchLoadFn<K, V>) {}

  load(key: K): Promise<V> {
    const cached = this.cache.get(key);
    if (cached !== undefined) return Promise.resolve(cached);
    return new Promise<V>((resolve, reject) => {
      this.queue.push({ key, resolve, reject });
      if (!this.scheduled) {
        this.scheduled = true;
        void Promise.resolve().then(() => this.flush());
      }
    });
  }

  private async flush(): Promise<void> {
    const batch = [...this.queue];
    this.queue = [];
    this.scheduled = false;
    const keys = batch.map((e) => e.key);
    const results = await this.batchFn(keys);
    dispatchResults(batch, results, this.cache);
  }

  loadMany(keys: readonly K[]): Promise<ReadonlyArray<V | Error>> {
    const promises = keys.map((k) =>
      this.load(k).catch((e: unknown): Error => (e instanceof Error ? e : new Error(String(e)))),
    );
    return Promise.all(promises);
  }

  /** Add a value directly to the cache without going through the batch function. */
  prime(key: K, value: V): void {
    this.cache.set(key, value);
  }

  /** Clear all cached values. */
  clearCache(): void {
    this.cache.clear();
  }
}

// ---------------------------------------------------------------------------
// DataLoaderRegistry
// ---------------------------------------------------------------------------

/**
 * Registry of named {@link DataLoader} instances.
 *
 * Useful for dependency injection — obtain the right loader by key.
 *
 * @example
 * ```ts
 * const registry = new DataLoaderRegistry();
 * registry.register('users', new DataLoader(batchLoadUsers));
 * const userLoader = registry.get<string, User>('users');
 * ```
 */
export class DataLoaderRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly loaders = new Map<string, DataLoader<any, any>>();

  register<K extends string | number, V>(name: string, loader: DataLoader<K, V>): void {
    this.loaders.set(name, loader);
  }

  get<K extends string | number, V>(name: string): DataLoader<K, V> | undefined {
    return this.loaders.get(name) as DataLoader<K, V> | undefined;
  }

  has(name: string): boolean {
    return this.loaders.has(name);
  }

  /** Clear all registrations. */
  clear(): void {
    this.loaders.clear();
  }
}
