/**
 * A recorded database query profile.
 */
export interface QueryProfile {
  readonly name: string;
  readonly durationMs: number;
  readonly rowCount?: number;
  readonly timestamp: Date;
}

function byDurationDesc(a: QueryProfile, b: QueryProfile): number {
  return b.durationMs - a.durationMs;
}

/**
 * Profiles database query durations (and optional row counts).
 * Call `profile()` to wrap any query function and have the timing recorded.
 */
export class QueryProfiler {
  private readonly profiles: QueryProfile[] = [];

  /**
   * Executes `fn`, records the duration under `name`, and returns the result.
   * The optional `getRowCount` callback extracts a row count from the result.
   */
  async profile<T>(
    name: string,
    fn: () => Promise<T>,
    getRowCount?: (result: T) => number,
  ): Promise<T> {
    const start = Date.now();
    const result = await fn();
    const durationMs = Date.now() - start;
    const rowCount = getRowCount?.(result);
    const entry: QueryProfile = {
      name,
      durationMs,
      timestamp: new Date(),
      ...(rowCount === undefined ? {} : { rowCount }),
    };
    this.profiles.push(entry);
    return result;
  }

  /** Returns all recorded profiles in insertion order. */
  getProfiles(): ReadonlyArray<QueryProfile> {
    return [...this.profiles];
  }

  /** Returns the `n` slowest query profiles, descending by duration. */
  getSlowest(n: number): ReadonlyArray<QueryProfile> {
    return [...this.profiles].sort(byDurationDesc).slice(0, n);
  }

  /** Returns all profiles matching the given query name. */
  getByName(name: string): ReadonlyArray<QueryProfile> {
    return this.profiles.filter((p) => p.name === name);
  }

  /** Removes all stored profiles. */
  clear(): void {
    this.profiles.splice(0);
  }

  /** Returns the number of profiles stored. */
  size(): number {
    return this.profiles.length;
  }
}
