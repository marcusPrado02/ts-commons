/**
 * Integration tests for @acme/web-nestjs package
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Test file: NestJS testing utilities use any */
/* eslint-disable @typescript-eslint/no-unsafe-call -- Test file: NestJS testing utilities use any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Test file: NestJS testing utilities use any */
/* eslint-disable @typescript-eslint/no-unsafe-return -- Test file: Test controllers return any */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- Test file: Test request/response types */
/* eslint-disable max-lines-per-function -- Test file: Integration tests require comprehensive setup */

import { describe, it, expect, beforeEach } from 'vitest';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import {
  Controller,
  Get,
  Post,
  Body,
  UseInterceptors,
  UseGuards,
  Module,
} from '@nestjs/common';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import {
  CommonsCoreModule,
  CommonsObservabilityModule,
  CorrelationInterceptor,
  LoggingInterceptor,
  ErrorMappingInterceptor,
  RateLimitGuard,
  ValidationPipe,
  UseCase,
  CommandHandler,
  QueryHandler,
  type ValidatorFn,
} from '../src/index.js';
import type { Logger } from '@acme/observability';
import { Result } from '@acme/kernel';

describe('@acme/web-nestjs', () => {
  let app: INestApplication;
  let mockLogger: Logger;

  // Test DTOs
  interface CreateUserDto {
    name: string;
    email: string;
  }

  interface UserDto {
    id: string;
    name: string;
    email: string;
  }

  // Validator
  const createUserValidator: ValidatorFn<CreateUserDto> = (data) => {
    const dto = data as CreateUserDto;
    if (dto.email.includes('@') === false) {
      return Result.err(new Error('Invalid email'));
    }
    return Result.ok(dto);
  };

  // Test controller
  @UseCase('TestController')
  @Controller('test')
  @UseInterceptors(CorrelationInterceptor, LoggingInterceptor, ErrorMappingInterceptor)
  class TestController {

    @Get('ping')
    ping(): { message: string } {
      return { message: 'pong' };
    }

    @QueryHandler('GetUser')
    @Get('users/:id')
    getUser(): UserDto {
      return {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
      };
    }

    @CommandHandler('CreateUser')
    @Post('users')
    createUser(
      @Body(new ValidationPipe(createUserValidator)) dto: CreateUserDto
    ): { id: string; name: string } {
      return {
        id: '123',
        name: dto.name,
      };
    }

    @Post('error')
    throwError(): never {
      throw new Error('Test error');
    }

    @UseGuards(new RateLimitGuard({ maxRequests: 3, windowMs: 60000 }))
    @Post('rate-limited')
    rateLimited(): { message: string } {
      return { message: 'success' };
    }
  }

  @Module({
    imports: [
      CommonsCoreModule.forRoot(),
      CommonsObservabilityModule.forRoot({
        serviceName: 'test-service',
      }),
    ],
    controllers: [TestController],
  })
  class TestModule {}

  beforeEach(async () => {
    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    } as unknown as Logger;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestModule],
    })
      .overrideProvider('LOGGER')
      .useValue(mockLogger)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('Modules', () => {
    it('should initialize CommonsCoreModule', async () => {
      const module = await Test.createTestingModule({
        imports: [CommonsCoreModule.forRoot()],
      }).compile();

      const clock = module.get('CLOCK');
      expect(clock).toBeDefined();
    });

    it('should initialize CommonsObservabilityModule', async () => {
      const module = await Test.createTestingModule({
        imports: [
          CommonsObservabilityModule.forRoot({
            serviceName: 'test',
          }),
        ],
      }).compile();

      const logger = module.get('LOGGER');
      expect(logger).toBeDefined();
    });
  });

  describe('CorrelationInterceptor', () => {
    it('should generate correlation ID if not provided', async () => {
      const response = await request(app.getHttpServer()).get('/test/ping');

      expect(response.status).toBe(200);
      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(response.headers['x-correlation-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should use provided correlation ID', async () => {
      const correlationId = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app.getHttpServer())
        .get('/test/ping')
        .set('x-correlation-id', correlationId);

      expect(response.status).toBe(200);
      expect(response.headers['x-correlation-id']).toBe(correlationId);
    });
  });

  describe('Decorators', () => {
    it('should use @QueryHandler decorator', async () => {
      const response = await request(app.getHttpServer()).get(
        '/test/users/123'
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
      });
    });

    it('should use @CommandHandler decorator', async () => {
      const response = await request(app.getHttpServer())
        .post('/test/users')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: '123',
        name: 'Jane Doe',
      });
    });
  });

  describe('ValidationPipe', () => {
    it('should validate request body successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/test/users')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
        });

      expect(response.status).toBe(201);
    });

    it('should reject invalid request body', async () => {
      const response = await request(app.getHttpServer())
        .post('/test/users')
        .send({
          name: 'John Doe',
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
      // ErrorMappingInterceptor converts to Problem Details RFC 7807
      expect(response.body).toHaveProperty('title');
      expect(response.body.title).toContain('Invalid email');
    });
  });

  describe('ErrorMappingInterceptor', () => {
    it('should convert errors to Problem Details', async () => {
      const response = await request(app.getHttpServer()).post('/test/error');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('type');
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('status', 500);
    });
  });

  describe('RateLimitGuard', () => {
    it('should allow requests within limit', async () => {
      const response1 = await request(app.getHttpServer()).post(
        '/test/rate-limited'
      );
      const response2 = await request(app.getHttpServer()).post(
        '/test/rate-limited'
      );
      const response3 = await request(app.getHttpServer()).post(
        '/test/rate-limited'
      );

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      expect(response3.status).toBe(201);
    });

    it('should block requests exceeding limit', async () => {
      await request(app.getHttpServer()).post('/test/rate-limited');
      await request(app.getHttpServer()).post('/test/rate-limited');
      await request(app.getHttpServer()).post('/test/rate-limited');

      const response = await request(app.getHttpServer()).post(
        '/test/rate-limited'
      );

      expect(response.status).toBe(429);
      expect(response.body.message).toContain('Too many requests');
    });
  });

  describe('Full Integration', () => {
    it('should handle complete request lifecycle', async () => {
      const response = await request(app.getHttpServer())
        .post('/test/users')
        .set('x-correlation-id', '550e8400-e29b-41d4-a716-446655440001')
        .send({
          name: 'Integration Test',
          email: 'integration@example.com',
        });

      expect(response.status).toBe(201);
      expect(response.headers['x-correlation-id']).toBe(
        '550e8400-e29b-41d4-a716-446655440001'
      );
      expect(response.body).toEqual({
        id: '123',
        name: 'Integration Test',
      });
    });
  });
});
