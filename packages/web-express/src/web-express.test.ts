/**
 * Test file for @acme/web-express package
 * ESLint rules are relaxed for test files due to testing framework types
 * and the need to interact with Express types that contain 'any'.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';
import request from 'supertest';
import {
  correlationMiddleware,
  errorHandlerMiddleware,
  loggingMiddleware,
  validateBody,
  ValidationError,
  type ValidatorFn,
} from '../src/index.js';
import type { Logger } from '@acme/observability';

describe('@acme/web-express', () => {
  let app: Express;
  let mockLogger: Logger;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger;
  });

  describe('correlationMiddleware', () => {
    it('should generate correlation ID if not provided', async () => {
      app.use(correlationMiddleware(mockLogger));
      app.get('/test', (req: Request, res: Response) => {
        expect(req.correlationId).toBeDefined();
        expect(req.correlationId?.value).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
        res.json({ correlationId: req.correlationId?.value });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(response.body.correlationId).toBe(response.headers['x-correlation-id']);
    });

    it('should extract correlation ID from header', async () => {
      app.use(correlationMiddleware(mockLogger));
      app.get('/test', (req: Request, res: Response) => {
        res.json({ correlationId: req.correlationId?.value });
      });

      const testId = 'test-correlation-id-12345';
      const response = await request(app).get('/test').set('X-Correlation-ID', testId);

      expect(response.status).toBe(200);
      expect(response.headers['x-correlation-id']).toBe(testId);
      expect(response.body.correlationId).toBe(testId);
    });
  });

  describe('errorHandlerMiddleware', () => {
    beforeEach(() => {
      app.use(correlationMiddleware(mockLogger));
    });

    it('should handle errors and return Problem Details', async () => {
      app.get('/test', () => {
        throw new Error('Test error');
      });
      app.use(errorHandlerMiddleware(mockLogger));

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('type');
      expect(response.body).toHaveProperty('title', 'Error');
      expect(response.body).toHaveProperty('status', 500);
      expect(response.body).toHaveProperty('detail', 'Test error');
      expect(response.body).toHaveProperty('correlationId');
    });

    it('should handle validation errors with 400 status', async () => {
      app.post('/test', () => {
        throw new ValidationError('Validation failed', [
          { field: 'email', message: 'Invalid email' },
        ]);
      });
      app.use(errorHandlerMiddleware(mockLogger));

      const response = await request(app).post('/test');

      expect(response.status).toBe(400);
      expect(response.body.title).toBe('ValidationError');
    });
  });

  describe('loggingMiddleware', () => {
    it('should log incoming requests and responses', async () => {
      app.use(loggingMiddleware(mockLogger));
      app.get('/test', (_req: Request, res: Response) => {
        res.json({ success: true });
      });

      await request(app).get('/test');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Incoming request',
        expect.objectContaining({
          httpMethod: 'GET',
          path: '/test',
        }),
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Request completed',
        expect.objectContaining({
          httpMethod: 'GET',
          path: '/test',
          status: 200,
        }),
      );
    });
  });

  describe('validateBody', () => {
    const nameValidator: ValidatorFn<{ name: string }> = (data) => {
      if (typeof data === 'object' && data !== null && 'name' in data) {
        return { success: true, data: data as { name: string } };
      }
      return {
        success: false,
        errors: [{ field: 'name', message: 'Name is required' }],
      };
    };

    it('should validate request body successfully', async () => {
      app.post('/test', validateBody(nameValidator), (req: Request, res: Response) => {
        res.json({ name: req.body.name });
      });
      app.use(errorHandlerMiddleware(mockLogger));

      const response = await request(app).post('/test').send({ name: 'John' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ name: 'John' });
    });

    it('should reject invalid request body', async () => {
      app.post('/test', validateBody(nameValidator), (req: Request, res: Response) => {
        res.json(req.body);
      });
      app.use(errorHandlerMiddleware(mockLogger));

      const response = await request(app).post('/test').send({});

      expect(response.status).toBe(400);
      expect(response.body.title).toBe('ValidationError');
    });
  });

  describe('integration', () => {
    it('should handle complete request lifecycle', async () => {
      // Setup complete middleware stack
      app.use(correlationMiddleware(mockLogger));
      app.use(loggingMiddleware(mockLogger));

      // Route with validation
      const validator: ValidatorFn<{ email: string }> = (data) => {
        if (
          typeof data === 'object' &&
          data !== null &&
          'email' in data &&
          typeof (data as { email: unknown }).email === 'string' &&
          (data as { email: string }).email.includes('@')
        ) {
          return { success: true, data: data as { email: string } };
        }
        return {
          success: false,
          errors: [{ field: 'email', message: 'Valid email is required' }],
        };
      };

      app.post('/users', validateBody(validator), (req: Request, res: Response) => {
        res.status(201).json({
          id: '123',
          email: req.body.email,
          correlationId: req.correlationId?.value,
        });
      });

      // Error handler
      app.use(errorHandlerMiddleware(mockLogger));

      // Make request
      const response = await request(app).post('/users').send({ email: 'test@example.com' });

      // Assertions
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email', 'test@example.com');
      expect(response.body).toHaveProperty('correlationId');
      expect(response.headers['x-correlation-id']).toBe(response.body.correlationId);

      // Check logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Incoming request',
        expect.objectContaining({ httpMethod: 'POST', path: '/users' }),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Request completed',
        expect.objectContaining({ httpMethod: 'POST', status: 201 }),
      );
    });
  });
});
