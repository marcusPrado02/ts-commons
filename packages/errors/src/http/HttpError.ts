import type { ProblemDetails } from './ProblemDetails';

/**
 * Base HTTP error with Problem Details.
 */
export class HttpError extends Error {
  constructor(
    public readonly problemDetails: ProblemDetails,
    cause?: Error,
  ) {
    super(problemDetails.detail ?? problemDetails.title, { cause });
    this.name = 'HttpError';
  }

  get status(): number {
    return this.problemDetails.status;
  }
}
