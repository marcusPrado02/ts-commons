import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  correlationHook,
  errorHandlerHook,
  loggingHook,
  FastifyControllerAdapter,
  FastifyContextAdapter,
} from './index';
import { Result } from '@acme/kernel';
import type { UseCase } from '@acme/application';
import type { Logger } from '@acme/observability';

// Local error types matching the ones in ErrorHandlerHook
class ValidationError extends Error {
  constructor(message: string, public errors?: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Mock logger matching Logger interface
const mockLogger = {
  serviceName: 'test',
  context: {},
  log: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  withContext: () => mockLogger,
} as unknown as Logger;

describe('Fastify Adapter - Correlation Hook', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook('onRequest', correlationHook());
    app.get('/test', async (request, _reply) => {
      return { correlationId: request.headers['x-correlation-id'] };
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should generate correlation ID if not provided', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.correlationId).toBeDefined();
    expect(body.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('should use provided correlation ID', async () => {
    const correlationId = 'test-correlation-123';
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        'x-correlation-id': correlationId,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.correlationId).toBe(correlationId);
  });
});

describe('Fastify Adapter - Error Handler', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook('onRequest', correlationHook());
    app.setErrorHandler(errorHandlerHook(mockLogger));

    app.get('/error', async () => {
      throw new Error('Test error');
    });

    app.get('/validation-error', async () => {
      throw new ValidationError('Invalid input', [
        { field: 'email', message: 'Invalid email format' },
      ]);
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should convert error to Problem Details', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/error',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.type).toBe('about:blank');
    expect(body.title).toBe('Internal Server Error');
    expect(body.status).toBe(500);
    expect(body.detail).toBe('Test error');
    expect(body.correlationId).toBeDefined();
  });

  it('should handle validation errors with 400 status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/validation-error',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.type).toBe('validation-error');
    expect(body.title).toBe('Validation Error');
    expect(body.status).toBe(400);
  });
});

describe('Fastify Adapter - Logging Hook', () => {
  let app: FastifyInstance;
  const logs: Array<{ message: string; data: unknown }> = [];

  const captureLogger = {
    serviceName: 'test',
    context: {},
    log: () => {},
    debug: () => {},
    info: (message: string, data?: unknown) => {
      logs.push({ message, data });
    },
    warn: () => {},
    error: () => {},
    withContext: function() { return this; },
  } as unknown as Logger;

  beforeAll(async () => {
    app = Fastify();
    app.addHook('onRequest', correlationHook());
    app.addHook('onRequest', loggingHook(captureLogger));

    app.get('/test', async () => {
      return { success: true };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should log request and response', async () => {
    logs.length = 0;

    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(200);
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const requestLog = logs.find(log => log.message === 'HTTP Request');
    expect(requestLog).toBeDefined();
    expect((requestLog?.data as { httpMethod: string })?.httpMethod).toBe('GET');
    expect((requestLog?.data as { path: string })?.path).toBe('/test');
  });
});

describe('Fastify Adapter - Controller Adapter', () => {
  let app: FastifyInstance;

  // Mock use case
  const mockUseCase: UseCase<{ id: string }, { id: string; name: string }, Error> = {
    execute: async (input: { id: string }) => {
      if (input.id === '404') {
        return Result.err(new Error('Not found'));
      }
      return Result.ok({ id: input.id, name: 'Test User' });
    },
  };

  beforeAll(async () => {
    app = Fastify();
    app.setErrorHandler(errorHandlerHook(mockLogger));

    app.get('/users/:id', FastifyControllerAdapter.adaptQuery(mockUseCase));
    app.post('/users', FastifyControllerAdapter.adaptCreate(mockUseCase));

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should adapt query use case successfully', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/users/123',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.id).toBe('123');
    expect(body.name).toBe('Test User');
  });

  it('should handle errors from use case', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/users/404',
    });

    expect(response.statusCode).toBe(500);
  });

  it('should return 201 for create operations', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { id: 'new-user' },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.id).toBe('new-user');
  });
});

describe('Fastify Adapter - Context Adapter', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook('onRequest', correlationHook());
    app.addHook('onRequest', FastifyContextAdapter.contextHook());

    app.get('/context', async (request) => {
      return request.useCaseContext;
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should extract context from request', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/context',
      headers: {
        'x-correlation-id': 'test-123',
        'x-tenant-id': 'tenant-456',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.correlationId).toBe('test-123');
    expect(body.tenantId).toBe('tenant-456');
  });
});

describe('Fastify Adapter - Full Integration', () => {
  let app: FastifyInstance;

  const testUseCase: UseCase<{ name: string }, { id: string; name: string }, ValidationError> = {
    execute: async (input: { name: string }) => {
      if (!input.name) {
        return Result.err(new ValidationError('Name is required', [
          { field: 'name', message: 'Name cannot be empty' },
        ]));
      }
      return Result.ok({ id: '123', name: input.name });
    },
  };

  beforeAll(async () => {
    app = Fastify();

    // Register all hooks
    app.addHook('onRequest', correlationHook());
    app.addHook('onRequest', loggingHook(mockLogger));
    app.addHook('onRequest', FastifyContextAdapter.contextHook());
    app.setErrorHandler(errorHandlerHook(mockLogger));

    // Register routes
    app.post('/users', FastifyControllerAdapter.adaptCreate(testUseCase));

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should handle full request lifecycle with all middleware', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/users',
      headers: {
        'x-tenant-id': 'tenant-789',
      },
      payload: { name: 'John Doe' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers['x-correlation-id']).toBeDefined();

    const body = JSON.parse(response.body);
    expect(body.id).toBe('123');
    expect(body.name).toBe('John Doe');
  });

  it('should handle validation errors through full stack', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: '' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.type).toBe('validation-error');
    expect(body.correlationId).toBeDefined();
  });
});
