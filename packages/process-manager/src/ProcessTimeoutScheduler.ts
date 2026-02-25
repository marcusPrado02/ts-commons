/**
 * A pending timeout entry.
 */
interface TimeoutEntry {
  readonly processId: string;
  readonly fireAt: Date;
  readonly callback: () => void;
}

/**
 * Schedules and tracks per-process timeouts.
 *
 * In production the scheduler can be driven by real `setTimeout` clocks;
 * in tests call `tick(now)` to fire all expired entries deterministically.
 */
export class ProcessTimeoutScheduler {
  private readonly pending = new Map<string, TimeoutEntry>();

  /**
   * Register a timeout for a process.
   * If the process already has a pending timeout it is replaced.
   */
  schedule(processId: string, delayMs: number, callback: () => void): void {
    const fireAt = new Date(Date.now() + delayMs);
    this.pending.set(processId, { processId, fireAt, callback });
  }

  /** Cancel a scheduled timeout. No-op if the process has no pending timeout. */
  cancel(processId: string): void {
    this.pending.delete(processId);
  }

  /**
   * Fire all entries whose `fireAt` is on or before `now` (defaults to current time).
   * Fired entries are removed from the pending set before the callback is invoked.
   */
  tick(now: Date = new Date()): void {
    for (const [id, entry] of this.pending) {
      if (entry.fireAt <= now) {
        this.pending.delete(id);
        entry.callback();
      }
    }
  }

  /** IDs of all processes that currently have a pending timeout. */
  getPendingIds(): string[] {
    return Array.from(this.pending.keys());
  }

  /** Total number of pending timeouts. */
  getPendingCount(): number {
    return this.pending.size;
  }

  /** True if the given process has a registered timeout that has not fired yet. */
  hasPending(processId: string): boolean {
    return this.pending.has(processId);
  }
}
