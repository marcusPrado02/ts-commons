/** Thrown when a job cannot be found in the registry. */
export class JobNotFoundError extends Error {
  override readonly name = 'JobNotFoundError';
  constructor(readonly jobId: string) {
    super(`Job "${jobId}" is not registered`);
  }
}

/** Thrown when attempting to register a job that is already registered. */
export class JobAlreadyRegisteredError extends Error {
  override readonly name = 'JobAlreadyRegisteredError';
  constructor(readonly jobId: string) {
    super(`Job "${jobId}" is already registered`);
  }
}

/** Thrown when a job execution fails and the error must be surfaced as an exception. */
export class JobExecutionError extends Error {
  override readonly name = 'JobExecutionError';
  constructor(
    readonly jobId: string,
    readonly executionId: string,
    override readonly cause?: unknown,
  ) {
    super(`Job "${jobId}" execution "${executionId}" failed`);
  }
}

/** Thrown when a job has reached its maximum allowed concurrent executions. */
export class JobConcurrencyLimitError extends Error {
  override readonly name = 'JobConcurrencyLimitError';
  constructor(
    readonly jobId: string,
    readonly maxConcurrency: number,
  ) {
    super(`Job "${jobId}" exceeded max concurrency of ${maxConcurrency}`);
  }
}

/** Thrown when all retry attempts for a single execution are exhausted. */
export class JobMaxRetriesExceededError extends Error {
  override readonly name = 'JobMaxRetriesExceededError';
  constructor(
    readonly jobId: string,
    readonly attempts: number,
    override readonly cause?: unknown,
  ) {
    super(`Job "${jobId}" exceeded max retries after ${attempts} attempt(s)`);
  }
}

/** Thrown when a cron expression cannot be parsed. */
export class InvalidCronExpressionError extends Error {
  override readonly name = 'InvalidCronExpressionError';
  constructor(
    readonly expression: string,
    reason: string,
  ) {
    super(`Invalid cron expression "${expression}": ${reason}`);
  }
}
