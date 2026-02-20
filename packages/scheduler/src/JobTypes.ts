// ---------------------------------------------------------------------------
// Execution context passed to Job.execute
// ---------------------------------------------------------------------------

export interface JobContext {
  readonly jobId: string;
  readonly executionId: string;
  readonly scheduledAtMs: number;
  readonly attemptNumber: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Core job abstraction
// ---------------------------------------------------------------------------

export interface Job {
  readonly name: string;
  execute(context: JobContext): Promise<void>;
}

// ---------------------------------------------------------------------------
// Job lifecycle status
// ---------------------------------------------------------------------------

export type JobStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled';

// ---------------------------------------------------------------------------
// Schedule configuration (discriminated union)
// ---------------------------------------------------------------------------

export interface IntervalScheduleConfig {
  readonly kind: 'interval';
  readonly intervalMs: number;
  readonly runImmediately?: boolean;
}

export interface CronScheduleConfig {
  readonly kind: 'cron';
  /** Standard 5-field cron expression: minute hour dayOfMonth month dayOfWeek */
  readonly expression: string;
}

export interface OnceScheduleConfig {
  readonly kind: 'once';
  /** Unix-epoch timestamp (ms) at which the job should run. */
  readonly runAtMs: number;
}

export type JobScheduleConfig = IntervalScheduleConfig | CronScheduleConfig | OnceScheduleConfig;

// ---------------------------------------------------------------------------
// Execution record (immutable snapshot per execution)
// ---------------------------------------------------------------------------

export interface JobRecord {
  readonly jobId: string;
  readonly jobName: string;
  readonly executionId: string;
  readonly status: JobStatus;
  readonly scheduledAtMs: number;
  readonly startedAtMs?: number;
  readonly completedAtMs?: number;
  readonly failureReason?: string;
  readonly attemptNumber: number;
}

// ---------------------------------------------------------------------------
// Job registration (scheduler input)
// ---------------------------------------------------------------------------

export interface JobRegistration {
  readonly jobId: string;
  readonly job: Job;
  readonly schedule: JobScheduleConfig;
  readonly maxConcurrency?: number;
  readonly maxRetries?: number;
  readonly retryBackoffMs?: number;
}

// ---------------------------------------------------------------------------
// Scheduler-wide statistics
// ---------------------------------------------------------------------------

export interface SchedulerStats {
  readonly totalExecutions: number;
  readonly successfulExecutions: number;
  readonly failedExecutions: number;
  readonly activeExecutions: number;
}
