import type { JobRecord, JobRegistration, SchedulerStats } from './JobTypes';

/**
 * Primary port for the scheduling system.
 *
 * Implementations must be able to register jobs, trigger them on demand, and
 * expose history / statistics without throwing for expected business conditions
 * (unknown executionId returns `undefined` rather than throwing).
 */
export interface SchedulerPort {
  /** Register a job. Throws {@link JobAlreadyRegisteredError} if already registered. */
  register(registration: JobRegistration): void;

  /** Remove a registered job. Throws {@link JobNotFoundError} if not registered. */
  unregister(jobId: string): void;

  /** Immediately execute a job, respecting concurrency limits. */
  trigger(jobId: string, metadata?: Readonly<Record<string, unknown>>): Promise<JobRecord>;

  /** Retrieve a single execution record by its execution id. */
  getRecord(executionId: string): Promise<JobRecord | undefined>;

  /** Retrieve full execution history for a job. */
  getJobHistory(jobId: string): Promise<readonly JobRecord[]>;

  /** Return current aggregate statistics for this scheduler instance. */
  getStats(): Promise<SchedulerStats>;

  /** Whether a job with the given id is currently registered. */
  isRegistered(jobId: string): boolean;
}
