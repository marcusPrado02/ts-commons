import { JobConcurrencyLimitError, JobNotFoundError } from './JobErrors';
import { ConcurrencyLimiter } from './ConcurrencyLimiter';
import { JobRegistry } from './JobRegistry';
import type { SchedulerPort } from './SchedulerPort';
import type { Job, JobContext, JobRecord, JobRegistration, SchedulerStats } from './JobTypes';

// ---------------------------------------------------------------------------
// Injectable delay (avoids real timers in tests)
// ---------------------------------------------------------------------------

export type DelayFn = (ms: number) => Promise<void>;

const defaultDelay: DelayFn = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Mutable stats
// ---------------------------------------------------------------------------

interface StatsInternal {
  total: number;
  succeeded: number;
  failed: number;
  active: number;
}

function incrementActive(s: StatsInternal): StatsInternal {
  return { ...s, total: s.total + 1, active: s.active + 1 };
}

function decrementActive(s: StatsInternal, outcome: 'succeeded' | 'failed'): StatsInternal {
  if (outcome === 'succeeded') return { ...s, succeeded: s.succeeded + 1, active: s.active - 1 };
  return { ...s, failed: s.failed + 1, active: s.active - 1 };
}

// ---------------------------------------------------------------------------
// Record helpers
// ---------------------------------------------------------------------------

let idCounter = 0;

function nextExecutionId(): string {
  idCounter += 1;
  return `exec-${idCounter.toString()}-${Date.now().toString()}`;
}

function buildRunningRecord(reg: JobRegistration, executionId: string): JobRecord {
  const now = Date.now();
  return {
    jobId: reg.jobId,
    jobName: reg.job.name,
    executionId,
    status: 'running',
    scheduledAtMs: now,
    startedAtMs: now,
    attemptNumber: 1,
  };
}

function succeededRecord(base: JobRecord): JobRecord {
  return { ...base, status: 'succeeded', completedAtMs: Date.now() };
}

function failedRecord(base: JobRecord, reason: string): JobRecord {
  return { ...base, status: 'failed', completedAtMs: Date.now(), failureReason: reason };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

async function runWithRetries(
  job: Job,
  context: JobContext,
  maxRetries: number,
  backoffMs: number,
  delay: DelayFn,
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await job.execute({ ...context, attemptNumber: attempt + 1 });
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) await delay(backoffMs * 2 ** attempt);
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

/**
 * In-memory implementation of {@link SchedulerPort}.
 *
 * Executes jobs synchronously within `trigger()` — no real timers. Combine
 * with {@link IntervalRunner} to drive periodic execution.
 *
 * @example
 * ```ts
 * const scheduler = new InMemoryScheduler();
 * scheduler.register({ jobId: 'report', job: reportJob, schedule: { kind: 'interval', intervalMs: 60_000 } });
 * const record = await scheduler.trigger('report');
 * // record.status === 'succeeded'
 * ```
 */
export class InMemoryScheduler implements SchedulerPort {
  private readonly registry = new JobRegistry();
  private readonly records = new Map<string, JobRecord>();
  private readonly history = new Map<string, string[]>();
  private readonly limiters = new Map<string, ConcurrencyLimiter>();
  private stats: StatsInternal = { total: 0, succeeded: 0, failed: 0, active: 0 };
  private readonly delay: DelayFn;

  constructor(delayFn?: DelayFn) {
    this.delay = delayFn ?? defaultDelay;
  }

  register(registration: JobRegistration): void {
    this.registry.register(registration);
    this.limiters.set(registration.jobId, new ConcurrencyLimiter(registration.maxConcurrency ?? 1));
  }

  unregister(jobId: string): void {
    this.registry.unregister(jobId);
    this.limiters.delete(jobId);
  }

  isRegistered(jobId: string): boolean {
    return this.registry.has(jobId);
  }

  async trigger(
    jobId: string,
    metadata: Readonly<Record<string, unknown>> = {},
  ): Promise<JobRecord> {
    const reg = this.registry.get(jobId);
    if (reg === undefined) throw new JobNotFoundError(jobId);

    const limiter = this.limiters.get(jobId);
    if (limiter !== undefined && !limiter.isAllowed(jobId)) {
      throw new JobConcurrencyLimitError(jobId, reg.maxConcurrency ?? 1);
    }
    limiter?.acquire(jobId);

    const executionId = nextExecutionId();
    const base = buildRunningRecord(reg, executionId);
    this.records.set(executionId, base);
    this.appendHistory(jobId, executionId);
    this.stats = incrementActive(this.stats);

    return this.run(reg, base, metadata, limiter);
  }

  private async run(
    reg: JobRegistration,
    base: JobRecord,
    metadata: Readonly<Record<string, unknown>>,
    limiter: ConcurrencyLimiter | undefined,
  ): Promise<JobRecord> {
    const context: JobContext = {
      jobId: base.jobId,
      executionId: base.executionId,
      scheduledAtMs: base.scheduledAtMs,
      attemptNumber: 1,
      metadata,
    };
    try {
      await runWithRetries(
        reg.job,
        context,
        reg.maxRetries ?? 0,
        reg.retryBackoffMs ?? 100,
        this.delay,
      );
      return this.finalize(base, 'succeeded', undefined, limiter);
    } catch (err) {
      return this.finalize(base, 'failed', errorMessage(err), limiter);
    }
  }

  private finalize(
    base: JobRecord,
    outcome: 'succeeded' | 'failed',
    reason: string | undefined,
    limiter: ConcurrencyLimiter | undefined,
  ): JobRecord {
    const done =
      outcome === 'succeeded' ? succeededRecord(base) : failedRecord(base, reason ?? 'unknown');
    this.records.set(base.executionId, done);
    this.stats = decrementActive(this.stats, outcome);
    limiter?.release(base.jobId);
    return done;
  }

  private appendHistory(jobId: string, executionId: string): void {
    const existing = this.history.get(jobId) ?? [];
    this.history.set(jobId, [...existing, executionId]);
  }

  getRecord(executionId: string): Promise<JobRecord | undefined> {
    return Promise.resolve(this.records.get(executionId));
  }

  getJobHistory(jobId: string): Promise<readonly JobRecord[]> {
    const ids = this.history.get(jobId) ?? [];
    const result = ids.flatMap((id) => {
      const r = this.records.get(id);
      return r === undefined ? [] : [r];
    });
    return Promise.resolve(result);
  }

  getStats(): Promise<SchedulerStats> {
    return Promise.resolve({
      totalExecutions: this.stats.total,
      successfulExecutions: this.stats.succeeded,
      failedExecutions: this.stats.failed,
      activeExecutions: this.stats.active,
    });
  }

  /** Reset all state — useful between tests. */
  clear(): void {
    this.registry.clear();
    this.records.clear();
    this.history.clear();
    this.limiters.clear();
    this.stats = { total: 0, succeeded: 0, failed: 0, active: 0 };
  }
}
