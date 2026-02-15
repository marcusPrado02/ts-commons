import { describe, it, expect } from 'vitest';
import { ProblemDetailsBuilder } from '../src/http/ProblemDetails';

describe('ProblemDetails', () => {
  describe('ProblemDetailsBuilder', () => {
    it('should create minimal problem details', () => {
      const problem = ProblemDetailsBuilder
        .create('about:blank', 'Not Found', 404)
        .build();

      expect(problem.type).toBe('about:blank');
      expect(problem.title).toBe('Not Found');
      expect(problem.status).toBe(404);
      expect(problem.detail).toBeUndefined();
      expect(problem.instance).toBeUndefined();
    });

    it('should create full problem details with all fields', () => {
      const errors = {
        email: ['Invalid email format'],
        password: ['Too short', 'Must contain special character'],
      };

      const problem = ProblemDetailsBuilder
        .create('/errors/validation', 'Validation Error', 400)
        .withDetail('Request validation failed')
        .withInstance('/users/create')
        .withErrors(errors)
        .withTraceId('trace-123')
        .withCorrelationId('corr-456')
        .build();

      expect(problem.type).toBe('/errors/validation');
      expect(problem.title).toBe('Validation Error');
      expect(problem.status).toBe(400);
      expect(problem.detail).toBe('Request validation failed');
      expect(problem.instance).toBe('/users/create');
      expect(problem.errors).toEqual(errors);
      expect(problem.traceId).toBe('trace-123');
      expect(problem.correlationId).toBe('corr-456');
    });

    it('should support fluent interface', () => {
      const builder = ProblemDetailsBuilder
        .create('/errors/test', 'Test Error', 500);

      const result1 = builder.withDetail('Detail 1');
      const result2 = builder.withInstance('/test');

      expect(result1).toBe(builder);
      expect(result2).toBe(builder);
    });

    it('should handle optional fields correctly', () => {
      const problem1 = ProblemDetailsBuilder
        .create('about:blank', 'Error', 500)
        .withDetail('Some detail')
        .build();

      expect(problem1.detail).toBe('Some detail');
      expect(problem1.instance).toBeUndefined();
      expect(problem1.errors).toBeUndefined();

      const problem2 = ProblemDetailsBuilder
        .create('about:blank', 'Error', 500)
        .build();

      expect(problem2.detail).toBeUndefined();
    });

    it('should create problem for different HTTP statuses', () => {
      const badRequest = ProblemDetailsBuilder
        .create('/errors/bad-request', 'Bad Request', 400)
        .build();

      const unauthorized = ProblemDetailsBuilder
        .create('/errors/unauthorized', 'Unauthorized', 401)
        .build();

      const forbidden = ProblemDetailsBuilder
        .create('/errors/forbidden', 'Forbidden', 403)
        .build();

      const notFound = ProblemDetailsBuilder
        .create('/errors/not-found', 'Not Found', 404)
        .build();

      const serverError = ProblemDetailsBuilder
        .create('/errors/server-error', 'Internal Server Error', 500)
        .build();

      expect(badRequest.status).toBe(400);
      expect(unauthorized.status).toBe(401);
      expect(forbidden.status).toBe(403);
      expect(notFound.status).toBe(404);
      expect(serverError.status).toBe(500);
    });

    it('should handle validation errors', () => {
      const errors = {
        name: ['Required field'],
        email: ['Invalid format', 'Already taken'],
        age: ['Must be at least 18'],
      };

      const problem = ProblemDetailsBuilder
        .create('/errors/validation', 'Validation Failed', 400)
        .withErrors(errors)
        .build();

      expect(problem.errors).toEqual(errors);
      expect(Object.keys(problem.errors!)).toHaveLength(3);
      expect(problem.errors!.email).toHaveLength(2);
    });

    it('should include tracing information', () => {
      const problem = ProblemDetailsBuilder
        .create('/errors/test', 'Test Error', 500)
        .withTraceId('trace-abc-123')
        .withCorrelationId('corr-def-456')
        .build();

      expect(problem.traceId).toBe('trace-abc-123');
      expect(problem.correlationId).toBe('corr-def-456');
    });

    it('should handle URI references correctly', () => {
      const absoluteUri = ProblemDetailsBuilder
        .create('https://example.com/errors/not-found', 'Not Found', 404)
        .build();

      const relativeUri = ProblemDetailsBuilder
        .create('/errors/validation', 'Validation Error', 400)
        .build();

      const blank = ProblemDetailsBuilder
        .create('about:blank', 'Generic Error', 500)
        .build();

      expect(absoluteUri.type).toBe('https://example.com/errors/not-found');
      expect(relativeUri.type).toBe('/errors/validation');
      expect(blank.type).toBe('about:blank');
    });
  });
});
