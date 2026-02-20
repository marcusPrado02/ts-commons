import type { SchedulerPort } from './SchedulerPort';

// ---------------------------------------------------------------------------
// Injectable timer types (enable fast unit tests without real timers)
// ---------------------------------------------------------------------------

export type TimerHandle = ReturnType<typeof setInterval>;
export type SetIntervalFn = (callback: () => void, ms: number) => TimerHandle;
export type ClearIntervalFn = (handle: TimerHandle) => void;

export interface IntervalRunnerOptions {
  readonly setInterval?: SetIntervalFn;
  readonly clearInterval?: ClearIntervalFn;
}

const globalSetInterval: SetIntervalFn = (cb, ms) => setInterval(cb, ms);
const globalClearInterval: ClearIntervalFn = (h) => clearInterval(h);

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Drives a {@link SchedulerPort} by repeatedly triggering registered jobs at
 * a fixed interval using `setInterval` (injectable for testing).
 *
 * Execution errors are swallowed at the runner level — they are captured
 * inside the {@link JobRecord} returned by `trigger`.
 *
 * @example
 * ```ts
 * const runner = new IntervalRunner(scheduler);
 * runner.start('cleanup', 60_000); // trigger every minute
 * runner.stop('cleanup');
 * runner.stopAll();
 * ```
 */
export class IntervalRunner {
  private readonly handles = new Map<string, TimerHandle>();
  private readonly setIntervalFn: SetIntervalFn;
  private readonly clearIntervalFn: ClearIntervalFn;

  constructor(
    private readonly scheduler: SchedulerPort,
    options?: IntervalRunnerOptions,
  ) {
    this.setIntervalFn = options?.setInterval ?? globalSetInterval;
    this.clearIntervalFn = options?.clearInterval ?? globalClearInterval;
  }

  /**
   * Start triggering `jobId` every `intervalMs` milliseconds.
   * No-op if an interval for this job is already running.
   */
  start(jobId: string, intervalMs: number): void {
    if (this.handles.has(jobId)) return;
    const handle = this.setIntervalFn(() => {
      void this.scheduler.trigger(jobId).catch(() => undefined);
    }, intervalMs);
    this.handles.set(jobId, handle);
  }

  /** Stop the interval for `jobId`. No-op if not running. */
  stop(jobId: string): void {
    const handle = this.handles.get(jobId);
    if (handle !== undefined) {
      this.clearIntervalFn(handle);
      this.handles.delete(jobId);
    }
  }

  /** Stop all active intervals. */
  stopAll(): void {
    for (const jobId of [...this.handles.keys()]) {
      this.stop(jobId);
    }
  }

  /** Whether an interval is currently active for `jobId`. */
  isRunning(jobId: string): boolean {
    return this.handles.has(jobId);
  }

  /** Number of currently active intervals. */
  get activeCount(): number {
    return this.handles.size;
  }
}
