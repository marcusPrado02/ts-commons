import type { GraphQLError, GraphQLErrorExtensions } from './GraphQLTypes';

// ---------------------------------------------------------------------------
// Problem Details base type
// ---------------------------------------------------------------------------

export interface ProblemDetails {
  /** A URI reference that identifies the problem type. */
  readonly type: string;
  /** A human-readable summary of the problem type. */
  readonly title: string;
  /** HTTP status code. */
  readonly status: number;
  /** Human-readable explanation specific to this occurrence. */
  readonly detail?: string;
  /** URI that identifies the specific occurrence of the problem. */
  readonly instance?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildExtensions(problem: ProblemDetails): GraphQLErrorExtensions {
  return {
    type: problem.type,
    title: problem.title,
    status: problem.status,
    ...(problem.detail === undefined ? {} : { detail: problem.detail }),
    ...(problem.instance === undefined ? {} : { instance: problem.instance }),
  };
}

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

/**
 * Converts arbitrary errors into a {@link GraphQLError} whose `extensions`
 * follow the RFC 7807 Problem Details schema.
 *
 * @example
 * ```ts
 * const formatter = new ProblemDetailsFormatter();
 * const gqlError = formatter.format(new Error('Not found'), 404, {
 *   type: 'https://problems.example.com/not-found',
 *   title: 'Resource Not Found',
 * });
 * // → { message: 'Not found', extensions: { type, title, status: 404 } }
 * ```
 */
export class ProblemDetailsFormatter {
  constructor(private readonly defaultType = 'https://problems.example.com/internal-error') {}

  format(err: unknown, status = 500, overrides?: Partial<ProblemDetails>): GraphQLError {
    const message = err instanceof Error ? err.message : String(err);
    const problem: ProblemDetails = {
      type: overrides?.type ?? this.defaultType,
      title: overrides?.title ?? this.statusTitle(status),
      status: overrides?.status ?? status,
      ...(overrides?.detail !== undefined ? { detail: overrides.detail } : {}),
      ...(overrides?.instance !== undefined ? { instance: overrides.instance } : {}),
    };
    return { message, extensions: buildExtensions(problem) };
  }

  /** Format a validation error (HTTP 400). */
  formatValidation(message: string, detail?: string): GraphQLError {
    return this.format(new Error(message), 400, {
      type: 'https://problems.example.com/validation-error',
      title: 'Validation Error',
      ...(detail === undefined ? {} : { detail }),
    });
  }

  /** Format a not-found error (HTTP 404). */
  formatNotFound(resource: string): GraphQLError {
    return this.format(new Error(`${resource} not found`), 404, {
      type: 'https://problems.example.com/not-found',
      title: 'Not Found',
      detail: `The requested ${resource} could not be found.`,
    });
  }

  /** Format an unauthorized error (HTTP 401). */
  formatUnauthorized(detail?: string): GraphQLError {
    return this.format(new Error('Unauthorized'), 401, {
      type: 'https://problems.example.com/unauthorized',
      title: 'Unauthorized',
      ...(detail === undefined ? {} : { detail }),
    });
  }

  private statusTitle(status: number): string {
    const titles: Readonly<Record<number, string>> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error',
      503: 'Service Unavailable',
    };
    return titles[status] ?? 'Error';
  }
}
