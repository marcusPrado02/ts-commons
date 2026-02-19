/**
 * Simple counters for tracking idempotency operation outcomes.
 */
export class IdempotencyMetrics {
  private _hits = 0;
  private _misses = 0;
  private _conflicts = 0;
  private _errors = 0;

  /** Duplicate request — result served from cache. */
  recordHit(): void {
    this._hits++;
  }

  /** New request — inner operation will execute. */
  recordMiss(): void {
    this._misses++;
  }

  /** Concurrent duplicate while operation is still in progress. */
  recordConflict(): void {
    this._conflicts++;
  }

  /** Inner operation threw an unexpected error. */
  recordError(): void {
    this._errors++;
  }

  get hits(): number {
    return this._hits;
  }
  get misses(): number {
    return this._misses;
  }
  get conflicts(): number {
    return this._conflicts;
  }
  get errors(): number {
    return this._errors;
  }

  /** Returns a point-in-time snapshot. */
  snapshot(): { hits: number; misses: number; conflicts: number; errors: number } {
    return {
      hits: this._hits,
      misses: this._misses,
      conflicts: this._conflicts,
      errors: this._errors,
    };
  }

  /** Resets all counters to zero. */
  reset(): void {
    this._hits = 0;
    this._misses = 0;
    this._conflicts = 0;
    this._errors = 0;
  }
}
