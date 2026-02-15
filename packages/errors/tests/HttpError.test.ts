import { describe, it, expect } from 'vitest';
import { HttpError } from '../src/http/HttpError';
import { ProblemDetailsBuilder } from '../src/http/ProblemDetails';

describe('HttpError', () => {
  describe('creation', () => {
    it('should create error with problem details', () => {
      const problem = ProblemDetailsBuilder
        .create('/errors/not-found', 'Not Found', 404)
        .withDetail('User not found')
        .build();

      const error = new HttpError(problem);

      expect(error.problemDetails).toBe(problem);
      expect(error.message).toBe('User not found');
      expect(error.name).toBe('HttpError');
    });

    it('should use title as message when detail is missing', () => {
      const problem = ProblemDetailsBuilder
        .create('/errors/test', 'Test Error', 500)
        .build();

      const error = new HttpError(problem);

      expect(error.message).toBe('Test Error');
    });

    it('should include cause when provided', () => {
      const cause = new Error('Original error');
      const problem = ProblemDetailsBuilder
        .create('/errors/test', 'Test Error', 500)
        .build();

      const error = new HttpError(problem, cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('status accessor', () => {
    it('should return HTTP status code', () => {
      const problem = ProblemDetailsBuilder
        .create('/errors/bad-request', 'Bad Request', 400)
        .build();

      const error = new HttpError(problem);

      expect(error.status).toBe(400);
    });

    it('should handle different status codes', () => {
      const statuses = [400, 401, 403, 404, 409, 422, 500, 503];

      statuses.forEach(status => {
        const problem = ProblemDetailsBuilder
          .create('/errors/test', 'Test', status)
          .build();

        const error = new HttpError(problem);
        expect(error.status).toBe(status);
      });
    });
  });

  describe('error properties', () => {
    it('should be an instance of Error', () => {
      const problem = ProblemDetailsBuilder
        .create('/errors/test', 'Test', 500)
        .build();

      const error = new HttpError(problem);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(HttpError);
    });

    it('should have stack trace', () => {
      const problem = ProblemDetailsBuilder
        .create('/errors/test', 'Test', 500)
        .build();

      const error = new HttpError(problem);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('HttpError');
    });
  });

  describe('common HTTP errors', () => {
    it('should create 400 Bad Request', () => {
      const problem = ProblemDetailsBuilder
        .create('/errors/bad-request', 'Bad Request', 400)
        .withDetail('Invalid input data')
        .build();

      const error = new HttpError(problem);

      expect(error.status).toBe(400);
      expect(error.problemDetails.title).toBe('Bad Request');
    });

    it('should create  401 Unauthorized', () => {
      const problem = ProblemDetailsBuilder
        .create('/errors/unauthorized', 'Unauthorized', 401)
        .withDetail('Authentication required')
        .build();

      const error = new HttpError(problem);

      expect(error.status).toBe(401);
    });

    it('should create 403 Forbidden', () => {
      const problem = ProblemDetailsBuilder
        .create('/errors/forbidden', 'Forbidden', 403)
        .withDetail('Insufficient permissions')
        .build();

      const error = new HttpError(problem);

      expect(error.status).toBe(403);
    });

    it('should create 404 Not Found', () => {
      const problem = ProblemDetailsBuilder
        .create('/errors/not-found', 'Not Found', 404)
        .withDetail('Resource does not exist')
        .build();

      const error = new HttpError(problem);

      expect(error.status).toBe(404);
    });

    it('should create 409 Conflict', () => {
      const problem = ProblemDetailsBuilder
        .create('/errors/conflict', 'Conflict', 409)
        .withDetail('Resource already exists')
        .build();

      const error = new HttpError(problem);

      expect(error.status).toBe(409);
    });

    it('should create 422 Unprocessable Entity with validation errors', () => {
      const problem = ProblemDetailsBuilder
        .create('/errors/validation', 'Validation Failed', 422)
        .withErrors({
          email: ['Invalid format'],
          password: ['Too weak'],
        })
        .build();

      const error = new HttpError(problem);

      expect(error.status).toBe(422);
      expect(error.problemDetails.errors).toBeDefined();
    });

    it('should create 500 Internal Server Error', () => {
      const problem = ProblemDetailsBuilder
        .create('/errors/server-error', 'Internal Server Error', 500)
        .build();

      const error = new HttpError(problem);

      expect(error.status).toBe(500);
    });
  });

  describe('tracing information', () => {
    it('should include trace and correlation IDs', () => {
      const problem = ProblemDetailsBuilder
        .create('/errors/test', 'Test', 500)
        .withTraceId('trace-123')
        .withCorrelationId('corr-456')
        .build();

      const error = new HttpError(problem);

      expect(error.problemDetails.traceId).toBe('trace-123');
      expect(error.problemDetails.correlationId).toBe('corr-456');
    });
  });
});
