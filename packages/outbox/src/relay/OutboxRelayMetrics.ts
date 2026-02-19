/**
 * Accumulates counters for an {@link OutboxRelay} run cycle.
 */
export class OutboxRelayMetrics {
  private _published = 0;
  private _failed = 0;
  private _skipped = 0;

  /** Increments the count of successfully published messages. */
  recordPublished(): void {
    this._published++;
  }

  /** Increments the count of publish failures. */
  recordFailed(): void {
    this._failed++;
  }

  /** Increments the count of messages skipped (exceeded max attempts → DLQ). */
  recordSkipped(): void {
    this._skipped++;
  }

  get published(): number {
    return this._published;
  }

  get failed(): number {
    return this._failed;
  }

  get skipped(): number {
    return this._skipped;
  }

  /** Returns a plain-object snapshot of current counters. */
  snapshot(): { readonly published: number; readonly failed: number; readonly skipped: number } {
    return {
      published: this._published,
      failed: this._failed,
      skipped: this._skipped,
    };
  }

  /** Resets all counters to zero. */
  reset(): void {
    this._published = 0;
    this._failed = 0;
    this._skipped = 0;
  }
}
