# @acme/scheduler

Job scheduling abstraction with in-memory and persistent backends. Supports cron expressions, intervals, one-time delays, concurrency limits, and automatic retry.

## Installation

```bash
pnpm add @acme/scheduler
```

## Quick Start

```typescript
import { InMemoryScheduler } from '@acme/scheduler';

const scheduler = new InMemoryScheduler();

// Cron job
scheduler.register({
  id: 'daily-report',
  schedule: { type: 'cron', cron: '0 8 * * *' },
  handler: async (ctx) => {
    await generateDailyReport(ctx.runAt);
  },
});

// Interval job
scheduler.register({
  id: 'health-ping',
  schedule: { type: 'interval', intervalMs: 30_000 },
  handler: async () => {
    await pingDependencies();
  },
});

await scheduler.start();
```

## One-Time Delay

```typescript
scheduler.register({
  id: 'send-reminder',
  schedule: { type: 'once', runAt: new Date('2026-04-01T09:00:00Z') },
  handler: async () => {
    await sendEmail(userId, 'reminder');
  },
});
```

## Stats

```typescript
const stats = scheduler.stats();
// stats.totalRuns, stats.failedRuns, stats.pendingJobs
```

## See Also

- [`@acme/process-manager`](../process-manager) — state machine processes
- [`@acme/saga`](../saga) — distributed saga orchestration
