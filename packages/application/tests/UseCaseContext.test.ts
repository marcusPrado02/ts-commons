import { describe, it, expect } from 'vitest';
import type { UseCaseContext } from '../src';
import { CorrelationId, RequestId, TenantId } from '@acme/kernel';

describe('UseCaseContext', () => {
  describe('basic structure', () => {
    it('should create a context with required fields', () => {
      const context: UseCaseContext = {
        correlationId: CorrelationId.fromString('corr-123'),
        requestId: RequestId.fromString('req-456'),
        timestamp: new Date('2024-01-01T00:00:00Z'),
      };

      expect(context.correlationId.value).toBe('corr-123');
      expect(context.requestId.value).toBe('req-456');
      expect(context.timestamp).toEqual(new Date('2024-01-01T00:00:00Z'));
      expect(context.tenantId).toBeUndefined();
      expect(context.userId).toBeUndefined();
      expect(context.metadata).toBeUndefined();
    });

    it('should create a context with all fields', () => {
      const context: UseCaseContext = {
        correlationId: CorrelationId.fromString('corr-123'),
        requestId: RequestId.fromString('req-456'),
        tenantId: TenantId.create('tenant-789'),
        userId: 'user-101',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        metadata: {
          source: 'web',
          ipAddress: '192.168.1.1',
        },
      };

      expect(context.correlationId.value).toBe('corr-123');
      expect(context.requestId.value).toBe('req-456');
      expect(context.tenantId?.value).toBe('tenant-789');
      expect(context.userId).toBe('user-101');
      expect(context.timestamp).toEqual(new Date('2024-01-01T12:00:00Z'));
      expect(context.metadata).toEqual({
        source: 'web',
        ipAddress: '192.168.1.1',
      });
    });
  });

  describe('multi-tenancy', () => {
    it('should support single tenant context', () => {
      const context: UseCaseContext = {
        correlationId: CorrelationId.fromString('corr-1'),
        requestId: RequestId.fromString('req-1'),
        tenantId: TenantId.create('acme-corp'),
        timestamp: new Date(),
      };

      expect(context.tenantId?.value).toBe('acme-corp');
    });

    it('should support context without tenant (system operations)', () => {
      const context: UseCaseContext = {
        correlationId: CorrelationId.fromString('corr-1'),
        requestId: RequestId.fromString('req-1'),
        timestamp: new Date(),
        metadata: { type: 'system-job' },
      };

      expect(context.tenantId).toBeUndefined();
      expect(context.metadata?.['type']).toBe('system-job');
    });
  });

  describe('user context', () => {
    it('should include authenticated user', () => {
      const context: UseCaseContext = {
        correlationId: CorrelationId.fromString('corr-1'),
        requestId: RequestId.fromString('req-1'),
        userId: 'user-123',
        timestamp: new Date(),
      };

      expect(context.userId).toBe('user-123');
    });

    it('should support anonymous operations', () => {
      const context: UseCaseContext = {
        correlationId: CorrelationId.fromString('corr-1'),
        requestId: RequestId.fromString('req-1'),
        timestamp: new Date(),
      };

      expect(context.userId).toBeUndefined();
    });
  });

  describe('metadata', () => {
    it('should store custom metadata', () => {
      const context: UseCaseContext = {
        correlationId: CorrelationId.fromString('corr-1'),
        requestId: RequestId.fromString('req-1'),
        timestamp: new Date(),
        metadata: {
          userAgent: 'Mozilla/5.0',
          language: 'pt-BR',
          timezone: 'America/Sao_Paulo',
        },
      };

      expect(context.metadata?.['userAgent']).toBe('Mozilla/5.0');
      expect(context.metadata?.['language']).toBe('pt-BR');
      expect(context.metadata?.['timezone']).toBe('America/Sao_Paulo');
    });

    it('should support nested metadata', () => {
      const context: UseCaseContext = {
        correlationId: CorrelationId.fromString('corr-1'),
        requestId: RequestId.fromString('req-1'),
        timestamp: new Date(),
        metadata: {
          request: {
            method: 'POST',
            path: '/api/users',
            headers: {
              'content-type': 'application/json',
            },
          },
          feature: {
            flags: ['new-ui', 'beta-feature'],
          },
        },
      };

      expect((context.metadata?.['request'] as { method: string }).method).toBe('POST');
      expect((context.metadata?.['feature'] as { flags: string[] }).flags).toEqual(['new-ui', 'beta-feature']);
    });

    it('should support various metadata types', () => {
      const context: UseCaseContext = {
        correlationId: CorrelationId.fromString('corr-1'),
        requestId: RequestId.fromString('req-1'),
        timestamp: new Date(),
        metadata: {
          string: 'value',
          number: 42,
          boolean: true,
          null: null,
          array: [1, 2, 3],
          object: { nested: 'data' },
        },
      };

      expect(context.metadata?.['string']).toBe('value');
      expect(context.metadata?.['number']).toBe(42);
      expect(context.metadata?.['boolean']).toBe(true);
      expect(context.metadata?.['null']).toBeNull();
      expect(context.metadata?.['array']).toEqual([1, 2, 3]);
      expect((context.metadata?.['object'] as { nested: string }).nested).toBe('data');
    });
  });

  describe('tracing and correlation', () => {
    it('should support distributed tracing', () => {
      const correlationId = CorrelationId.fromString('trace-abc-123');
      const requestId1 = RequestId.fromString('req-1');
      const requestId2 = RequestId.fromString('req-2');

      const context1: UseCaseContext = {
        correlationId: correlationId,
        requestId: requestId1,
        timestamp: new Date(),
      };

      const context2: UseCaseContext = {
        correlationId: correlationId,
        requestId: requestId2,
        timestamp: new Date(),
        metadata: {
          parentRequestId: requestId1.value,
        },
      };

      expect(context1.correlationId.value).toBe(context2.correlationId.value);
      expect(context1.requestId.value).not.toBe(context2.requestId.value);
      expect(context2.metadata?.['parentRequestId']).toBe(requestId1.value);
    });

    it('should support causation tracking', () => {
      const context: UseCaseContext = {
        correlationId: CorrelationId.fromString('corr-1'),
        requestId: RequestId.fromString('req-1'),
        timestamp: new Date(),
        metadata: {
          causationId: 'event-123',
          causationType: 'OrderCreated',
        },
      };

      expect(context.metadata?.['causationId']).toBe('event-123');
      expect(context.metadata?.['causationType']).toBe('OrderCreated');
    });
  });

  describe('timestamps', () => {
    it('should track exact timestamp', () => {
      const now = new Date('2024-03-15T10:30:00.000Z');
      const context: UseCaseContext = {
        correlationId: CorrelationId.fromString('corr-1'),
        requestId: RequestId.fromString('req-1'),
        timestamp: now,
      };

      expect(context.timestamp).toEqual(now);
      expect(context.timestamp.getTime()).toBe(now.getTime());
    });

    it('should preserve millisecond precision', () => {
      const precise = new Date('2024-03-15T10:30:00.123Z');
      const context: UseCaseContext = {
        correlationId: CorrelationId.fromString('corr-1'),
        requestId: RequestId.fromString('req-1'),
        timestamp: precise,
      };

      expect(context.timestamp.getMilliseconds()).toBe(123);
    });
  });

  describe('context propagation', () => {
    it('should be passable between use cases', () => {
      function createContext(): UseCaseContext {
        return {
          correlationId: CorrelationId.fromString('corr-123'),
          requestId: RequestId.fromString('req-456'),
          tenantId: TenantId.create('tenant-789'),
          userId: 'user-101',
          timestamp: new Date(),
        };
      }

      function useCase1(context: UseCaseContext): void {
        expect(context.correlationId.value).toBe('corr-123');
        useCase2(context);
      }

      function useCase2(context: UseCaseContext): void {
        expect(context.correlationId.value).toBe('corr-123');
        expect(context.tenantId?.value).toBe('tenant-789');
      }

      const context = createContext();
      useCase1(context);
    });

    it('should support context enrichment', () => {
      const baseContext: UseCaseContext = {
        correlationId: CorrelationId.fromString('corr-1'),
        requestId: RequestId.fromString('req-1'),
        timestamp: new Date(),
      };

      const enrichedContext: UseCaseContext = {
        ...baseContext,
        userId: 'user-123',
        metadata: {
          ...baseContext.metadata,
          enrichedBy: 'auth-middleware',
          roles: ['admin', 'user'],
        },
      };

      expect(enrichedContext.correlationId.value).toBe(baseContext.correlationId.value);
      expect(enrichedContext.userId).toBe('user-123');
      expect(enrichedContext.metadata?.['enrichedBy']).toBe('auth-middleware');
    });
  });

  describe('use cases', () => {
    it('should support audit logging', () => {
      function logAudit(action: string, context: UseCaseContext): object {
        return {
          action,
          correlationId: context.correlationId,
          requestId: context.requestId,
          tenantId: context.tenantId,
          userId: context.userId,
          timestamp: context.timestamp.toISOString(),
          metadata: context.metadata,
        };
      }

      const context: UseCaseContext = {
        correlationId: CorrelationId.fromString('corr-1'),
        requestId: RequestId.fromString('req-1'),
        tenantId: TenantId.create('acme'),
        userId: 'user-123',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        metadata: { ipAddress: '127.0.0.1' },
      };

      const auditLog = logAudit('CreateOrder', context);

      expect(auditLog).toEqual({
        action: 'CreateOrder',
        correlationId: expect.objectContaining({ _value: 'corr-1' }) as CorrelationId,
        requestId: expect.objectContaining({ _value: 'req-1' }) as RequestId,
        tenantId: expect.objectContaining({ _value: 'acme' }) as TenantId,
        userId: 'user-123',
        timestamp: '2024-01-01T00:00:00.000Z',
        metadata: { ipAddress: '127.0.0.1' },
      });
    });

    it('should support authorization checks', () => {
      function isAuthorized(context: UseCaseContext, requiredRole: string): boolean {
        const roles = context.metadata?.['roles'] as string[] | undefined;
        return roles ? roles.includes(requiredRole) : false;
      }

      const adminContext: UseCaseContext = {
        correlationId: CorrelationId.fromString('corr-1'),
        requestId: RequestId.fromString('req-1'),
        userId: 'admin-user',
        timestamp: new Date(),
        metadata: {
          roles: ['admin', 'user'],
        },
      };

      const userContext: UseCaseContext = {
        correlationId: CorrelationId.fromString('corr-2'),
        requestId: RequestId.fromString('req-2'),
        userId: 'regular-user',
        timestamp: new Date(),
        metadata: {
          roles: ['user'],
        },
      };

      expect(isAuthorized(adminContext, 'admin')).toBe(true);
      expect(isAuthorized(userContext, 'admin')).toBe(false);
      expect(isAuthorized(userContext, 'user')).toBe(true);
    });

    it('should support rate limiting', () => {
      interface RateLimitInfo {
        limit: number;
        remaining: number;
        resetAt: Date;
      }

      function addRateLimitInfo(context: UseCaseContext, limit: RateLimitInfo): UseCaseContext {
        return {
          ...context,
          metadata: {
            ...context.metadata,
            rateLimit: limit,
          },
        };
      }

      const context: UseCaseContext = {
        correlationId: CorrelationId.fromString('corr-1'),
        requestId: RequestId.fromString('req-1'),
        userId: 'user-123',
        timestamp: new Date(),
      };

      const rateLimitedContext = addRateLimitInfo(context, {
        limit: 100,
        remaining: 95,
        resetAt: new Date(Date.now() + 3600000),
      });

      const rateLimit = rateLimitedContext.metadata?.['rateLimit'] as RateLimitInfo;
      expect(rateLimit.limit).toBe(100);
      expect(rateLimit.remaining).toBe(95);
    });
  });
});
