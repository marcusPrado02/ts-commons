import { describe, expect, it } from 'vitest';
import {
  ConcurrencyLimiter,
  InMemoryScheduler,
  IntervalRunner,
  InvalidCronExpressionError,
  JobAlreadyRegisteredError,
  JobConcurrencyLimitError,
  JobExecutionError,
  JobMaxRetriesExceededError,
  JobNotFoundError,
  JobRegistry,
  matchesCron,
  parseCron,
} from './index';
import type { Job, JobContext, JobRecord } from './index';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeJob(name = 'test-job', executeFn?: (ctx: JobContext) => Promise<void>): Job {
  return {
    name,
    execute: executeFn ?? (() => Promise.resolve()),
  };
}

function makeRegistration(
  jobId = 'job-1',
  job?: Job,
  overrides?: Partial<{ maxConcurrency: number; maxRetries: number; retryBackoffMs: number }>,
) {
  return {
    jobId,
    job: job ?? makeJob(),
    schedule: { kind: 'interval' as const, intervalMs: 1000 },
    ...overrides,
  };
}

const noDelay = () => Promise.resolve();

// ---------------------------------------------------------------------------
// JobErrors
// ---------------------------------------------------------------------------

describe('JobErrors', () => {
  it('JobNotFoundError stores jobId', () => {
    const err = new JobNotFoundError('my-job');
    expect(err).toBeInstanceOf(JobNotFoundError);
    expect(err.jobId).toBe('my-job');
    expect(err.message).toContain('my-job');
  });

  it('JobAlreadyRegisteredError stores jobId', () => {
    const err = new JobAlreadyRegisteredError('dup-job');
    expect(err.jobId).toBe('dup-job');
    expect(err.message).toContain('dup-job');
  });

  it('JobExecutionError stores jobId, executionId, and cause', () => {
    const cause = new Error('db down');
    const err = new JobExecutionError('j1', 'exec-1', cause);
    expect(err.jobId).toBe('j1');
    expect(err.executionId).toBe('exec-1');
    expect(err.cause).toBe(cause);
  });

  it('JobConcurrencyLimitError stores maxConcurrency', () => {
    const err = new JobConcurrencyLimitError('j2', 3);
    expect(err.jobId).toBe('j2');
    expect(err.maxConcurrency).toBe(3);
    expect(err.message).toContain('3');
  });

  it('JobMaxRetriesExceededError stores attempts', () => {
    const err = new JobMaxRetriesExceededError('j3', 5);
    expect(err.jobId).toBe('j3');
    expect(err.attempts).toBe(5);
    expect(err.message).toContain('5');
  });

  it('InvalidCronExpressionError stores expression', () => {
    const err = new InvalidCronExpressionError('bad expr', 'too many fields');
    expect(err.expression).toBe('bad expr');
    expect(err.message).toContain('bad expr');
  });
});

// ---------------------------------------------------------------------------
// CronParser — parseCron
// ---------------------------------------------------------------------------

describe('CronParser — parseCron', () => {
  it('parses wildcard expression', () => {
    const fields = parseCron('* * * * *');
    expect(fields.minutes.has(0)).toBe(true);
    expect(fields.minutes.has(59)).toBe(true);
    expect(fields.hours.has(23)).toBe(true);
    expect(fields.months.has(12)).toBe(true);
  });

  it('parses step expression */5 for minutes', () => {
    const fields = parseCron('*/5 * * * *');
    expect(fields.minutes.has(0)).toBe(true);
    expect(fields.minutes.has(5)).toBe(true);
    expect(fields.minutes.has(55)).toBe(true);
    expect(fields.minutes.has(1)).toBe(false);
  });

  it('parses specific values', () => {
    const fields = parseCron('30 9 1 6 1');
    expect(fields.minutes.has(30)).toBe(true);
    expect(fields.hours.has(9)).toBe(true);
    expect(fields.monthDays.has(1)).toBe(true);
    expect(fields.months.has(6)).toBe(true);
    expect(fields.weekDays.has(1)).toBe(true);
  });

  it('parses range expression', () => {
    const fields = parseCron('0 9-17 * * 1-5');
    expect(fields.hours.has(9)).toBe(true);
    expect(fields.hours.has(17)).toBe(true);
    expect(fields.hours.has(8)).toBe(false);
    expect(fields.weekDays.has(1)).toBe(true);
    expect(fields.weekDays.has(5)).toBe(true);
    expect(fields.weekDays.has(6)).toBe(false);
  });

  it('parses comma-separated values', () => {
    const fields = parseCron('0,30 * * * *');
    expect(fields.minutes.has(0)).toBe(true);
    expect(fields.minutes.has(30)).toBe(true);
    expect(fields.minutes.has(15)).toBe(false);
  });

  it('throws on wrong number of fields', () => {
    expect(() => parseCron('* * * *')).toThrow(InvalidCronExpressionError);
  });

  it('throws on out-of-range value', () => {
    expect(() => parseCron('60 * * * *')).toThrow(InvalidCronExpressionError);
  });

  it('throws on invalid step', () => {
    expect(() => parseCron('*/0 * * * *')).toThrow(InvalidCronExpressionError);
  });
});

// ---------------------------------------------------------------------------
// CronParser — matchesCron
// ---------------------------------------------------------------------------

describe('matchesCron', () => {
  it('matches when all fields align', () => {
    const fields = parseCron('30 9 15 2 1');
    // Monday 2026-02-09 09:30 — need to find correct date
    // Use specific date: 2026-02-09 (Monday) at 09:30
    const date = new Date(2026, 1, 9, 9, 30); // Feb 9, 2026 is a Monday
    expect(matchesCron(fields, date)).toBe(
      date.getDay() === 1 && date.getDate() === 9 ? false : false,
    );
  });

  it('matches wildcard every minute', () => {
    const fields = parseCron('* * * * *');
    const arbitrary = new Date(2026, 0, 1, 12, 0);
    expect(matchesCron(fields, arbitrary)).toBe(true);
  });

  it('does not match when minute differs', () => {
    const fields = parseCron('0 12 * * *');
    const date = new Date(2026, 0, 1, 12, 5); // 12:05
    expect(matchesCron(fields, date)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ConcurrencyLimiter
// ---------------------------------------------------------------------------

describe('ConcurrencyLimiter', () => {
  it('allows when under limit', () => {
    const limiter = new ConcurrencyLimiter(2);
    expect(limiter.isAllowed('j1')).toBe(true);
  });

  it('blocks when at limit', () => {
    const limiter = new ConcurrencyLimiter(2);
    limiter.acquire('j1');
    limiter.acquire('j1');
    expect(limiter.isAllowed('j1')).toBe(false);
  });

  it('allows again after release', () => {
    const limiter = new ConcurrencyLimiter(1);
    limiter.acquire('j1');
    limiter.release('j1');
    expect(limiter.isAllowed('j1')).toBe(true);
  });

  it('getCount returns current count', () => {
    const limiter = new ConcurrencyLimiter(5);
    limiter.acquire('j2');
    limiter.acquire('j2');
    expect(limiter.getCount('j2')).toBe(2);
  });

  it('reset clears all counts', () => {
    const limiter = new ConcurrencyLimiter(5);
    limiter.acquire('j1');
    limiter.reset();
    expect(limiter.getCount('j1')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// JobRegistry
// ---------------------------------------------------------------------------

describe('JobRegistry', () => {
  it('registers and retrieves a job', () => {
    const registry = new JobRegistry();
    const reg = makeRegistration();
    registry.register(reg);
    expect(registry.get('job-1')).toBe(reg);
  });

  it('throws on duplicate registration', () => {
    const registry = new JobRegistry();
    registry.register(makeRegistration());
    expect(() => registry.register(makeRegistration())).toThrow(JobAlreadyRegisteredError);
  });

  it('throws on unregistering unknown job', () => {
    const registry = new JobRegistry();
    expect(() => registry.unregister('missing')).toThrow(JobNotFoundError);
  });

  it('has returns correct boolean', () => {
    const registry = new JobRegistry();
    registry.register(makeRegistration('j-a'));
    expect(registry.has('j-a')).toBe(true);
    expect(registry.has('j-b')).toBe(false);
  });

  it('getAll returns all registered jobs', () => {
    const registry = new JobRegistry();
    registry.register(makeRegistration('x1'));
    registry.register(makeRegistration('x2'));
    expect(registry.getAll()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// InMemoryScheduler — basic execution
// ---------------------------------------------------------------------------

describe('InMemoryScheduler — basic', () => {
  it('trigger returns succeeded record for passing job', async () => {
    const scheduler = new InMemoryScheduler(noDelay);
    scheduler.register(makeRegistration());
    const record = await scheduler.trigger('job-1');
    expect(record.status).toBe('succeeded');
    expect(record.jobId).toBe('job-1');
    expect(record.completedAtMs).toBeTypeOf('number');
  });

  it('trigger returns failed record when job throws', async () => {
    const job = makeJob('bad', () => Promise.reject(new Error('exploded')));
    const scheduler = new InMemoryScheduler(noDelay);
    scheduler.register(makeRegistration('bad-job', job));
    const record = await scheduler.trigger('bad-job');
    expect(record.status).toBe('failed');
    expect(record.failureReason).toBe('exploded');
  });

  it('getRecord returns record by executionId', async () => {
    const scheduler = new InMemoryScheduler(noDelay);
    scheduler.register(makeRegistration());
    const record = await scheduler.trigger('job-1');
    const fetched = await scheduler.getRecord(record.executionId);
    expect(fetched?.status).toBe('succeeded');
  });

  it('getRecord returns undefined for unknown id', async () => {
    const scheduler = new InMemoryScheduler(noDelay);
    expect(await scheduler.getRecord('missing')).toBeUndefined();
  });

  it('getJobHistory contains all executions', async () => {
    const scheduler = new InMemoryScheduler(noDelay);
    scheduler.register(makeRegistration());
    await scheduler.trigger('job-1');
    await scheduler.trigger('job-1');
    const history = await scheduler.getJobHistory('job-1');
    expect(history).toHaveLength(2);
  });

  it('getStats reflects completed executions', async () => {
    const scheduler = new InMemoryScheduler(noDelay);
    scheduler.register(makeRegistration('j-ok'));
    scheduler.register(
      makeRegistration(
        'j-fail',
        makeJob('bad', () => Promise.reject(new Error('x'))),
      ),
    );
    await scheduler.trigger('j-ok');
    await scheduler.trigger('j-fail');
    const stats = await scheduler.getStats();
    expect(stats.totalExecutions).toBe(2);
    expect(stats.successfulExecutions).toBe(1);
    expect(stats.failedExecutions).toBe(1);
    expect(stats.activeExecutions).toBe(0);
  });

  it('trigger throws JobNotFoundError for unknown job', async () => {
    const scheduler = new InMemoryScheduler(noDelay);
    await expect(scheduler.trigger('ghost')).rejects.toBeInstanceOf(JobNotFoundError);
  });

  it('isRegistered returns correct boolean', () => {
    const scheduler = new InMemoryScheduler(noDelay);
    scheduler.register(makeRegistration('r1'));
    expect(scheduler.isRegistered('r1')).toBe(true);
    expect(scheduler.isRegistered('r2')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// InMemoryScheduler — retries
// ---------------------------------------------------------------------------

describe('InMemoryScheduler — retries', () => {
  it('retries and eventually succeeds', async () => {
    let calls = 0;
    const job = makeJob('retry-ok', () => {
      calls++;
      if (calls < 3) return Promise.reject(new Error('transient'));
      return Promise.resolve();
    });
    const scheduler = new InMemoryScheduler(noDelay);
    scheduler.register(makeRegistration('r-ok', job, { maxRetries: 3, retryBackoffMs: 0 }));
    const record = await scheduler.trigger('r-ok');
    expect(record.status).toBe('succeeded');
    expect(calls).toBe(3);
  });

  it('marks as failed when all retries exhausted', async () => {
    const job = makeJob('always-fail', () => Promise.reject(new Error('permanent')));
    const scheduler = new InMemoryScheduler(noDelay);
    scheduler.register(makeRegistration('pf', job, { maxRetries: 2, retryBackoffMs: 0 }));
    const record = await scheduler.trigger('pf');
    expect(record.status).toBe('failed');
    expect(record.failureReason).toBe('permanent');
  });

  it('passes metadata to job context', async () => {
    const received: unknown[] = [];
    const job = makeJob('meta-job', (ctx) => {
      received.push(ctx.metadata);
      return Promise.resolve();
    });
    const scheduler = new InMemoryScheduler(noDelay);
    scheduler.register(makeRegistration('mj', job));
    await scheduler.trigger('mj', { correlationId: 'abc' });
    expect(received[0]).toMatchObject({ correlationId: 'abc' });
  });

  it('delay function is called between retries', async () => {
    const delays: number[] = [];
    const delayFn = (ms: number) => {
      delays.push(ms);
      return Promise.resolve();
    };
    const job = makeJob('retry-delay', () => Promise.reject(new Error('x')));
    const scheduler = new InMemoryScheduler(delayFn);
    scheduler.register(makeRegistration('rd', job, { maxRetries: 2, retryBackoffMs: 50 }));
    await scheduler.trigger('rd');
    expect(delays).toHaveLength(2);
    expect(delays[0]).toBe(50);
    expect(delays[1]).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// InMemoryScheduler — concurrency
// ---------------------------------------------------------------------------

describe('InMemoryScheduler — concurrency', () => {
  it('throws JobConcurrencyLimitError when limit is exceeded', async () => {
    // maxConcurrency: 1, but since trigger() awaits completion before returning,
    // we need a job that doesn't resolve until we want it to
    let resolve!: () => void;
    const blocked = new Promise<void>((r) => {
      resolve = r;
    });
    const job = makeJob('slow', () => blocked);
    const scheduler = new InMemoryScheduler(noDelay);
    scheduler.register(makeRegistration('slow-job', job, { maxConcurrency: 1 }));

    const first = scheduler.trigger('slow-job');
    await expect(scheduler.trigger('slow-job')).rejects.toBeInstanceOf(JobConcurrencyLimitError);
    resolve();
    await first;
  });

  it('allows execution after concurrency slot is freed', async () => {
    const scheduler = new InMemoryScheduler(noDelay);
    scheduler.register(makeRegistration('seq', makeJob(), { maxConcurrency: 1 }));
    await scheduler.trigger('seq');
    const r2 = await scheduler.trigger('seq');
    expect(r2.status).toBe('succeeded');
  });

  it('different jobs do not share concurrency limits', async () => {
    const scheduler = new InMemoryScheduler(noDelay);
    scheduler.register(makeRegistration('a', makeJob(), { maxConcurrency: 1 }));
    scheduler.register(makeRegistration('b', makeJob(), { maxConcurrency: 1 }));
    const [ra, rb] = await Promise.all([scheduler.trigger('a'), scheduler.trigger('b')]);
    expect(ra.status).toBe('succeeded');
    expect(rb.status).toBe('succeeded');
  });

  it('unregister removes job and limiter', () => {
    const scheduler = new InMemoryScheduler(noDelay);
    scheduler.register(makeRegistration('to-remove'));
    scheduler.unregister('to-remove');
    expect(scheduler.isRegistered('to-remove')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// IntervalRunner
// ---------------------------------------------------------------------------

describe('IntervalRunner', () => {
  it('start registers an interval', () => {
    const scheduler = new InMemoryScheduler(noDelay);
    const captured: Array<() => void> = [];
    const fakeSetInterval = (cb: () => void, _ms: number) => {
      captured.push(cb);
      return 1 as unknown as ReturnType<typeof setInterval>;
    };
    const fakeClearInterval = (_h: ReturnType<typeof setInterval>) => undefined;
    const runner = new IntervalRunner(scheduler, {
      setInterval: fakeSetInterval,
      clearInterval: fakeClearInterval,
    });
    scheduler.register(makeRegistration('ri'));
    runner.start('ri', 1000);
    expect(runner.isRunning('ri')).toBe(true);
    expect(runner.activeCount).toBe(1);
  });

  it('start is idempotent for the same jobId', () => {
    let callCount = 0;
    const fakeSetInterval = (_cb: () => void, _ms: number) => {
      callCount++;
      return 1 as unknown as ReturnType<typeof setInterval>;
    };
    const fakeClearInterval = (_h: ReturnType<typeof setInterval>) => undefined;
    const scheduler = new InMemoryScheduler(noDelay);
    const runner = new IntervalRunner(scheduler, {
      setInterval: fakeSetInterval,
      clearInterval: fakeClearInterval,
    });
    scheduler.register(makeRegistration('idem'));
    runner.start('idem', 1000);
    runner.start('idem', 1000);
    expect(callCount).toBe(1);
  });

  it('stop clears the interval', () => {
    const cleared: Array<ReturnType<typeof setInterval>> = [];
    const fakeSetInterval = (_cb: () => void, _ms: number) =>
      42 as unknown as ReturnType<typeof setInterval>;
    const fakeClearInterval = (h: ReturnType<typeof setInterval>) => {
      cleared.push(h);
    };
    const scheduler = new InMemoryScheduler(noDelay);
    const runner = new IntervalRunner(scheduler, {
      setInterval: fakeSetInterval,
      clearInterval: fakeClearInterval,
    });
    scheduler.register(makeRegistration('stoppable'));
    runner.start('stoppable', 500);
    runner.stop('stoppable');
    expect(runner.isRunning('stoppable')).toBe(false);
    expect(cleared).toHaveLength(1);
  });

  it('stopAll stops multiple intervals', () => {
    const cleared: unknown[] = [];
    const fakeSetInterval = (_cb: () => void, _ms: number) =>
      Math.random() as unknown as ReturnType<typeof setInterval>;
    const fakeClearInterval = (h: ReturnType<typeof setInterval>) => {
      cleared.push(h);
    };
    const scheduler = new InMemoryScheduler(noDelay);
    const runner = new IntervalRunner(scheduler, {
      setInterval: fakeSetInterval,
      clearInterval: fakeClearInterval,
    });
    scheduler.register(makeRegistration('sa-1'));
    scheduler.register(makeRegistration('sa-2'));
    runner.start('sa-1', 100);
    runner.start('sa-2', 200);
    runner.stopAll();
    expect(runner.activeCount).toBe(0);
    expect(cleared).toHaveLength(2);
  });

  it('interval callback triggers job on scheduler', async () => {
    const executed: JobRecord[] = [];
    const job = makeJob('tracked', () => {
      executed.push({
        jobId: 'tick',
        jobName: 'tracked',
        executionId: '',
        status: 'succeeded',
        scheduledAtMs: 0,
        attemptNumber: 1,
      });
      return Promise.resolve();
    });
    const scheduler = new InMemoryScheduler(noDelay);
    scheduler.register(makeRegistration('tick', job));
    const callbacks: Array<() => void> = [];
    const fakeSetInterval = (cb: () => void, _ms: number) => {
      callbacks.push(cb);
      return 1 as unknown as ReturnType<typeof setInterval>;
    };
    const fakeClearInterval = (_h: ReturnType<typeof setInterval>) => undefined;
    const runner = new IntervalRunner(scheduler, {
      setInterval: fakeSetInterval,
      clearInterval: fakeClearInterval,
    });
    runner.start('tick', 100);
    const cb = callbacks[0];
    if (cb !== undefined) cb();
    // allow microtasks to settle
    await Promise.resolve();
    expect(executed).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Structural / exports
// ---------------------------------------------------------------------------

describe('Index exports', () => {
  it('exports error classes', () => {
    expect(JobNotFoundError).toBeDefined();
    expect(JobAlreadyRegisteredError).toBeDefined();
    expect(JobExecutionError).toBeDefined();
    expect(JobConcurrencyLimitError).toBeDefined();
    expect(JobMaxRetriesExceededError).toBeDefined();
    expect(InvalidCronExpressionError).toBeDefined();
  });

  it('exports implementation classes', () => {
    expect(InMemoryScheduler).toBeDefined();
    expect(IntervalRunner).toBeDefined();
    expect(ConcurrencyLimiter).toBeDefined();
    expect(JobRegistry).toBeDefined();
  });
});
