import { JobAlreadyRegisteredError, JobNotFoundError } from './JobErrors';
import type { JobRegistration } from './JobTypes';

/**
 * In-memory registry of {@link JobRegistration} records.
 *
 * Enforces unique job ids: re-registering an existing id throws
 * {@link JobAlreadyRegisteredError}.
 */
export class JobRegistry {
  private readonly jobs = new Map<string, JobRegistration>();

  /** Register a job. Throws if a job with the same id is already present. */
  register(registration: JobRegistration): void {
    if (this.jobs.has(registration.jobId)) {
      throw new JobAlreadyRegisteredError(registration.jobId);
    }
    this.jobs.set(registration.jobId, registration);
  }

  /** Remove a job. Throws {@link JobNotFoundError} if the id is not registered. */
  unregister(jobId: string): void {
    if (!this.jobs.has(jobId)) throw new JobNotFoundError(jobId);
    this.jobs.delete(jobId);
  }

  /** Return the registration for `jobId`, or `undefined` if not registered. */
  get(jobId: string): JobRegistration | undefined {
    return this.jobs.get(jobId);
  }

  /** Return all registered jobs in insertion order. */
  getAll(): readonly JobRegistration[] {
    return [...this.jobs.values()];
  }

  /** Whether a job with the given id is registered. */
  has(jobId: string): boolean {
    return this.jobs.has(jobId);
  }

  /** Remove all registrations. */
  clear(): void {
    this.jobs.clear();
  }
}
