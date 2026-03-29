# @marcusprado02/scheduler

In-process job scheduler for cron expressions and fixed-interval tasks.

**Install:** `pnpm add @marcusprado02/scheduler @marcusprado02/kernel`

---

## `InMemoryScheduler`

```typescript
import { InMemoryScheduler } from '@marcusprado02/scheduler';

const scheduler = new InMemoryScheduler();

// Fixed interval
scheduler.scheduleInterval('cleanup-expired-orders', {
  intervalMs: 60_000, // every 60 seconds
  handler: async () => {
    const deleted = await orderRepo.deleteExpired();
    log.info('Cleanup done', { deleted });
  },
});

// Cron expression
scheduler.scheduleCron('daily-summary-report', {
  cron: '0 8 * * *', // 08:00 every day
  handler: async () => {
    await reportService.generateDaily();
  },
});

scheduler.scheduleCron('hourly-metrics-flush', {
  cron: '0 * * * *', // top of every hour
  handler: async () => {
    await metricsExporter.flush();
  },
});

// Start all registered jobs
await scheduler.start();

// Always stop on graceful shutdown
shutdown.register('scheduler', () => scheduler.stop());
```

---

## `JobRegistry`

Manage jobs separately and pass them to the scheduler:

```typescript
import { JobRegistry, InMemoryScheduler } from '@marcusprado02/scheduler';

const registry = new JobRegistry();

registry.register({
  name: 'expire-orders',
  type: 'interval',
  intervalMs: 300_000,
  handler: () => orderRepo.expireOlderThan(Duration.ofDays(30)),
});

registry.register({
  name: 'send-reminders',
  type: 'cron',
  cron: '30 9 * * 1-5', // 09:30 weekdays
  handler: () => reminderService.sendPending(),
});

const scheduler = new InMemoryScheduler();
scheduler.loadFromRegistry(registry);
await scheduler.start();
```

---

## Concurrency and Error Handling

By default, concurrent runs of the same job are prevented — if the handler is still running when the next trigger fires, the new run is skipped and logged.

```typescript
scheduler.scheduleInterval('sync-inventory', {
  intervalMs: 30_000,
  handler: () => inventoryService.sync(),
  concurrency: 'skip', // 'skip' (default) | 'queue' | 'parallel'
  onError: (err) => log.error('Sync failed', { error: err.message }),
});
```

---

## `CronParser` — Cron Utilities

```typescript
import { CronParser } from '@marcusprado02/scheduler';

const parser = new CronParser('0 8 * * *');

const nextRun = parser.next(new Date()); // next scheduled Date
const prevRun = parser.prev(new Date()); // previous scheduled Date
const schedule = parser.describe(); // "Every day at 08:00"
```

---

## `IntervalRunner` — Low-Level Primitive

If you need raw interval control without the full scheduler:

```typescript
import { IntervalRunner } from '@marcusprado02/scheduler';

const runner = new IntervalRunner({
  intervalMs: 5_000,
  handler: () => outboxRelay.poll(),
  onError: (err) => log.error('Relay error', { error: err.message }),
});

await runner.start();
shutdown.register('interval-runner', () => runner.stop());
```

---

## Cron Expression Quick Reference

| Expression    | Schedule                 |
| ------------- | ------------------------ |
| `* * * * *`   | Every minute             |
| `0 * * * *`   | Every hour               |
| `0 0 * * *`   | Every day at midnight    |
| `0 8 * * *`   | Every day at 08:00       |
| `0 8 * * 1-5` | Weekdays at 08:00        |
| `0 0 1 * *`   | First day of every month |
| `*/5 * * * *` | Every 5 minutes          |

---

## Summary

| Export              | Purpose                                            |
| ------------------- | -------------------------------------------------- |
| `InMemoryScheduler` | Register and run interval + cron jobs              |
| `JobRegistry`       | Separate job definitions from the scheduler        |
| `CronParser`        | Parse cron expressions; compute next/prev run time |
| `IntervalRunner`    | Low-level periodic runner                          |
