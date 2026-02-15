import { DomainError, NotFoundError, ConflictError } from '@acme/kernel';
import { ProblemDetailsBuilder } from './ProblemDetails';
import { ProblemType } from './ProblemType';
import type { ProblemDetails } from './ProblemDetails';

/**
 * Maps domain errors to HTTP Problem Details.
 */
export class HttpErrorMapper {
  static toProblemDetails(error: Error): ProblemDetails {
    if (error instanceof NotFoundError) {
      return ProblemDetailsBuilder.create(ProblemType.NOT_FOUND, 'Not Found', 404)
        .withDetail(error.message)
        .build();
    }

    if (error instanceof ConflictError) {
      return ProblemDetailsBuilder.create(ProblemType.CONFLICT, 'Conflict', 409)
        .withDetail(error.message)
        .build();
    }

    if (error instanceof DomainError) {
      return ProblemDetailsBuilder.create(
        ProblemType.UNPROCESSABLE_ENTITY,
        'Domain Error',
        422,
      )
        .withDetail(error.message)
        .build();
    }

    // Default to 500 for unknown errors
    return ProblemDetailsBuilder.create(
      ProblemType.INTERNAL_SERVER_ERROR,
      'Internal Server Error',
      500,
    )
      .withDetail('An unexpected error occurred')
      .build();
  }
}
