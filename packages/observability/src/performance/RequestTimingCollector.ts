/**
 * A recorded HTTP request timing observation.
 */
export interface RequestTimingRecord {
  readonly method: string;
  readonly path: string;
  readonly statusCode?: number;
  readonly durationMs: number;
  readonly timestamp: Date;
}

/**
 * Collects and queries HTTP request timing records.
 * Designed to be used as middleware helper in any HTTP framework.
 */
export class RequestTimingCollector {
  private readonly records: RequestTimingRecord[] = [];

  /** Store a new timing record. */
  record(entry: RequestTimingRecord): void {
    this.records.push(entry);
  }

  /** Returns all recorded entries in insertion order. */
  getAll(): ReadonlyArray<RequestTimingRecord> {
    return [...this.records];
  }

  /** Returns entries with `durationMs` strictly above `thresholdMs`. */
  getSlow(thresholdMs: number): ReadonlyArray<RequestTimingRecord> {
    return this.records.filter((r) => r.durationMs > thresholdMs);
  }

  /** Returns entries matching the given HTTP method (case-insensitive). */
  getByMethod(method: string): ReadonlyArray<RequestTimingRecord> {
    const upper = method.toUpperCase();
    return this.records.filter((r) => r.method.toUpperCase() === upper);
  }

  /** Returns entries whose path exactly matches the given value. */
  getByPath(path: string): ReadonlyArray<RequestTimingRecord> {
    return this.records.filter((r) => r.path === path);
  }

  /** Returns entries with the given HTTP status code. */
  getByStatus(statusCode: number): ReadonlyArray<RequestTimingRecord> {
    return this.records.filter((r) => r.statusCode === statusCode);
  }

  /**
   * Computes average duration across all records, or `undefined` when empty.
   */
  averageDurationMs(): number | undefined {
    if (this.records.length === 0) return undefined;
    const sum = this.records.reduce((s, r) => s + r.durationMs, 0);
    return sum / this.records.length;
  }

  /** Removes all stored records. */
  clear(): void {
    this.records.splice(0);
  }

  /** Returns the number of records in the collector. */
  size(): number {
    return this.records.length;
  }
}
