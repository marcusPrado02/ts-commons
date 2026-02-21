import { beforeEach, describe, expect, it } from 'vitest';
import { AuditConfigError, AuditQueryError, AuditStorageError } from '../src/AuditErrors.js';
import { InMemoryAuditStorage } from '../src/InMemoryAuditStorage.js';
import { AuditService } from '../src/AuditService.js';
import { createAuditedFn } from '../src/AuditDecorator.js';
import { ComplianceReporter } from '../src/ComplianceReporter.js';
import type { AuditLog, AuditLogInput } from '../src/AuditTypes.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const BASE: AuditLogInput = {
  userId: 'u1',
  action: 'USER_CREATED',
  resource: 'User',
  resourceId: 'r1',
  ip: '127.0.0.1',
  userAgent: 'test-agent',
};

function makeLog(overrides: Partial<AuditLogInput> = {}): AuditLogInput {
  return { ...BASE, ...overrides };
}

function makeFullLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'test-id',
    timestamp: new Date('2025-01-01T00:00:00Z'),
    userId: 'u1',
    action: 'USER_CREATED',
    resource: 'User',
    resourceId: 'r1',
    changes: {},
    ip: '127.0.0.1',
    userAgent: 'test-agent',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AuditErrors
// ---------------------------------------------------------------------------
describe('AuditErrors', () => {
  it('AuditStorageError stores cause and name', () => {
    const cause = new Error('backend failed');
    const err = new AuditStorageError('write failed', cause);
    expect(err.name).toBe('AuditStorageError');
    expect(err.message).toContain('write failed');
    expect(err.cause).toBe(cause);
    expect(err).toBeInstanceOf(Error);
  });

  it('AuditStorageError without cause', () => {
    const err = new AuditStorageError('read error');
    expect(err.cause).toBeUndefined();
  });

  it('AuditQueryError wraps reason in message', () => {
    const err = new AuditQueryError('fromDate must be before toDate');
    expect(err.name).toBe('AuditQueryError');
    expect(err.message).toContain('fromDate must be before toDate');
  });

  it('AuditConfigError has correct name', () => {
    const err = new AuditConfigError('missing storage');
    expect(err.name).toBe('AuditConfigError');
    expect(err.message).toContain('missing storage');
  });
});

// ---------------------------------------------------------------------------
// InMemoryAuditStorage
// ---------------------------------------------------------------------------
describe('InMemoryAuditStorage', () => {
  let storage: InMemoryAuditStorage;

  beforeEach(() => {
    storage = new InMemoryAuditStorage();
  });

  describe('store', () => {
    it('stores an entry and increases size', async () => {
      await storage.store(makeFullLog());
      expect(storage.size()).toBe(1);
    });

    it('stores multiple entries', async () => {
      await storage.store(makeFullLog({ id: 'a' }));
      await storage.store(makeFullLog({ id: 'b' }));
      expect(storage.size()).toBe(2);
    });
  });

  describe('query — filters', () => {
    beforeEach(async () => {
      await storage.store(
        makeFullLog({
          id: '1',
          userId: 'alice',
          tenantId: 'acme',
          action: 'LOGIN',
          resource: 'Session',
          resourceId: 'sid1',
        }),
      );
      await storage.store(
        makeFullLog({
          id: '2',
          userId: 'bob',
          tenantId: 'acme',
          action: 'LOGOUT',
          resource: 'Session',
          resourceId: 'sid2',
        }),
      );
      await storage.store(
        makeFullLog({
          id: '3',
          userId: 'alice',
          tenantId: 'beta',
          action: 'USER_CREATED',
          resource: 'User',
          resourceId: 'uid1',
        }),
      );
    });

    it('no filter — returns all entries', async () => {
      const logs = await storage.query({});
      expect(logs).toHaveLength(3);
    });

    it('userId filter', async () => {
      const logs = await storage.query({ userId: 'alice' });
      expect(logs).toHaveLength(2);
      expect(logs.every((l) => l.userId === 'alice')).toBe(true);
    });

    it('tenantId filter', async () => {
      const logs = await storage.query({ tenantId: 'beta' });
      expect(logs).toHaveLength(1);
      expect(logs[0]?.tenantId).toBe('beta');
    });

    it('action filter', async () => {
      const logs = await storage.query({ action: 'LOGIN' });
      expect(logs).toHaveLength(1);
      expect(logs[0]?.action).toBe('LOGIN');
    });

    it('resource filter', async () => {
      const logs = await storage.query({ resource: 'User' });
      expect(logs).toHaveLength(1);
    });

    it('resourceId filter', async () => {
      const logs = await storage.query({ resourceId: 'sid2' });
      expect(logs).toHaveLength(1);
      expect(logs[0]?.id).toBe('2');
    });

    it('fromDate filter excludes earlier entries', async () => {
      storage.clear();
      const early = makeFullLog({ id: 'old', timestamp: new Date('2024-01-01') });
      const recent = makeFullLog({ id: 'new', timestamp: new Date('2025-06-01') });
      await storage.store(early);
      await storage.store(recent);
      const logs = await storage.query({ fromDate: new Date('2025-01-01') });
      expect(logs).toHaveLength(1);
      expect(logs[0]?.id).toBe('new');
    });

    it('toDate filter excludes later entries', async () => {
      storage.clear();
      const early = makeFullLog({ id: 'old', timestamp: new Date('2024-01-01') });
      const recent = makeFullLog({ id: 'new', timestamp: new Date('2025-06-01') });
      await storage.store(early);
      await storage.store(recent);
      const logs = await storage.query({ toDate: new Date('2025-01-01') });
      expect(logs).toHaveLength(1);
      expect(logs[0]?.id).toBe('old');
    });

    it('combined filter — userId + action', async () => {
      const logs = await storage.query({ userId: 'alice', action: 'LOGIN' });
      expect(logs).toHaveLength(1);
      expect(logs[0]?.id).toBe('1');
    });
  });

  describe('query — pagination', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 5; i++) {
        await storage.store(makeFullLog({ id: `log-${i}` }));
      }
    });

    it('limit restricts the number of results', async () => {
      const logs = await storage.query({ limit: 2 });
      expect(logs).toHaveLength(2);
    });

    it('offset skips entries', async () => {
      const logs = await storage.query({ offset: 3 });
      expect(logs).toHaveLength(2);
    });

    it('limit + offset together slice the result window', async () => {
      const logs = await storage.query({ offset: 1, limit: 2 });
      expect(logs).toHaveLength(2);
      expect(logs[0]?.id).toBe('log-2');
    });
  });

  describe('count', () => {
    it('returns 0 when storage is empty', async () => {
      expect(await storage.count({})).toBe(0);
    });

    it('counts all entries when no filter', async () => {
      await storage.store(makeFullLog({ id: 'a' }));
      await storage.store(makeFullLog({ id: 'b' }));
      expect(await storage.count({})).toBe(2);
    });

    it('counts only matching entries', async () => {
      await storage.store(makeFullLog({ id: 'a', userId: 'alice' }));
      await storage.store(makeFullLog({ id: 'b', userId: 'bob' }));
      expect(await storage.count({ userId: 'alice' })).toBe(1);
    });
  });

  it('checkHealth returns true', async () => {
    expect(await storage.checkHealth()).toBe(true);
  });

  it('clear removes all entries', async () => {
    await storage.store(makeFullLog());
    storage.clear();
    expect(storage.size()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AuditService
// ---------------------------------------------------------------------------
describe('AuditService', () => {
  let storage: InMemoryAuditStorage;
  let service: AuditService;

  beforeEach(() => {
    storage = new InMemoryAuditStorage();
    service = new AuditService(storage);
  });

  describe('log()', () => {
    it('returns a log entry with generated id and timestamp', async () => {
      const entry = await service.log(makeLog());
      expect(entry.id).toBeDefined();
      expect(entry.id.startsWith('audit-')).toBe(true);
      expect(entry.timestamp).toBeInstanceOf(Date);
    });

    it('persists the entry in storage', async () => {
      await service.log(makeLog());
      expect(storage.size()).toBe(1);
    });

    it('sets correct fields from input', async () => {
      const entry = await service.log(makeLog({ userId: 'alice', action: 'DELETE' }));
      expect(entry.userId).toBe('alice');
      expect(entry.action).toBe('DELETE');
    });

    it('includes tenantId when provided', async () => {
      const entry = await service.log(makeLog({ tenantId: 'acme' }));
      expect(entry.tenantId).toBe('acme');
    });

    it('omits tenantId when not provided', async () => {
      const entry = await service.log(makeLog());
      expect('tenantId' in entry).toBe(false);
    });

    it('defaults changes to empty object when omitted', async () => {
      const entry = await service.log(makeLog());
      expect(entry.changes).toEqual({});
    });

    it('stores provided changes', async () => {
      const entry = await service.log(makeLog({ changes: { name: { old: 'A', new: 'B' } } }));
      expect(entry.changes['name']?.old).toBe('A');
      expect(entry.changes['name']?.new).toBe('B');
    });
  });

  it('query delegates to storage', async () => {
    await service.log(makeLog({ userId: 'alice' }));
    await service.log(makeLog({ userId: 'bob' }));
    const logs = await service.query({ userId: 'alice' });
    expect(logs).toHaveLength(1);
  });

  it('count delegates to storage', async () => {
    await service.log(makeLog());
    await service.log(makeLog());
    expect(await service.count({})).toBe(2);
  });

  it('checkHealth delegates to storage', async () => {
    expect(await service.checkHealth()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createAuditedFn
// ---------------------------------------------------------------------------
describe('createAuditedFn', () => {
  let storage: InMemoryAuditStorage;
  let service: AuditService;

  beforeEach(() => {
    storage = new InMemoryAuditStorage();
    service = new AuditService(storage);
  });

  const ctx = { userId: 'system', ip: '10.0.0.1', userAgent: 'svc' };

  it('calls the original function and returns its result', async () => {
    const fn = (x: number) => Promise.resolve(x * 2);
    const wrapped = createAuditedFn(fn, service, { action: 'OP', resource: 'R' }, ctx);
    const result = await wrapped(21);
    expect(result).toBe(42);
  });

  it('writes an audit entry after the call', async () => {
    const fn = () => Promise.resolve('ok');
    const wrapped = createAuditedFn(fn, service, { action: 'CREATE', resource: 'Item' }, ctx);
    await wrapped();
    expect(storage.size()).toBe(1);
    const logs = await storage.query({});
    expect(logs[0]?.action).toBe('CREATE');
    expect(logs[0]?.resource).toBe('Item');
  });

  it('uses custom getUserId from args', async () => {
    const fn = (userId: string) => Promise.resolve(userId);
    const wrapped = createAuditedFn(
      fn,
      service,
      { action: 'OP', resource: 'R', getUserId: (args) => String(args[0]) },
      ctx,
    );
    await wrapped('custom-user');
    const logs = await storage.query({});
    expect(logs[0]?.userId).toBe('custom-user');
  });

  it('uses custom getResourceId from args', async () => {
    const fn = (id: string) => Promise.resolve(id);
    const wrapped = createAuditedFn(
      fn,
      service,
      { action: 'OP', resource: 'R', getResourceId: (args) => String(args[0]) },
      ctx,
    );
    await wrapped('res-42');
    const logs = await storage.query({});
    expect(logs[0]?.resourceId).toBe('res-42');
  });

  it('captures changes via getChanges', async () => {
    const fn = (val: string) => Promise.resolve(val);
    const wrapped = createAuditedFn(
      fn,
      service,
      {
        action: 'UPDATE',
        resource: 'Config',
        getChanges: (_args, result) => ({ value: { old: 'old', new: result } }),
      },
      ctx,
    );
    await wrapped('new-val');
    const logs = await storage.query({});
    expect(logs[0]?.changes['value']?.new).toBe('new-val');
  });

  it('propagates tenantId from context', async () => {
    const fn = () => Promise.resolve(true);
    const ctxWithTenant = { ...ctx, tenantId: 'acme-corp' };
    const wrapped = createAuditedFn(fn, service, { action: 'OP', resource: 'R' }, ctxWithTenant);
    await wrapped();
    const logs = await storage.query({});
    expect(logs[0]?.tenantId).toBe('acme-corp');
  });
});

// ---------------------------------------------------------------------------
// ComplianceReporter
// ---------------------------------------------------------------------------
describe('ComplianceReporter', () => {
  const reporter = new ComplianceReporter();
  const period = { from: new Date('2025-01-01'), to: new Date('2025-12-31') };

  it('totalEvents is zero for empty logs', () => {
    const report = reporter.generate([], period);
    expect(report.totalEvents).toBe(0);
    expect(report.byAction).toEqual({});
    expect(report.byUser).toEqual({});
    expect(report.byResource).toEqual({});
  });

  it('totalEvents equals number of logs', () => {
    const logs = [makeFullLog({ id: 'a' }), makeFullLog({ id: 'b' })];
    const report = reporter.generate(logs, period);
    expect(report.totalEvents).toBe(2);
  });

  it('byAction aggregates counts per action', () => {
    const logs = [
      makeFullLog({ id: '1', action: 'LOGIN' }),
      makeFullLog({ id: '2', action: 'LOGIN' }),
      makeFullLog({ id: '3', action: 'LOGOUT' }),
    ];
    const report = reporter.generate(logs, period);
    expect(report.byAction['LOGIN']).toBe(2);
    expect(report.byAction['LOGOUT']).toBe(1);
  });

  it('byUser aggregates counts per userId', () => {
    const logs = [
      makeFullLog({ id: '1', userId: 'alice' }),
      makeFullLog({ id: '2', userId: 'alice' }),
      makeFullLog({ id: '3', userId: 'bob' }),
    ];
    const report = reporter.generate(logs, period);
    expect(report.byUser['alice']).toBe(2);
    expect(report.byUser['bob']).toBe(1);
  });

  it('byResource aggregates counts per resource', () => {
    const logs = [
      makeFullLog({ id: '1', resource: 'User' }),
      makeFullLog({ id: '2', resource: 'Order' }),
      makeFullLog({ id: '3', resource: 'User' }),
    ];
    const report = reporter.generate(logs, period);
    expect(report.byResource['User']).toBe(2);
    expect(report.byResource['Order']).toBe(1);
  });

  it('generatedAt is a recent Date', () => {
    const before = Date.now();
    const report = reporter.generate([], period);
    const after = Date.now();
    expect(report.generatedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(report.generatedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('period is preserved in the report', () => {
    const report = reporter.generate([], period);
    expect(report.period.from).toBe(period.from);
    expect(report.period.to).toBe(period.to);
  });

  describe('generateFromStorage', () => {
    it('queries storage with fromDate/toDate and returns a report', async () => {
      const storage = new InMemoryAuditStorage();
      const inRange = makeFullLog({ id: 'in', timestamp: new Date('2025-06-15'), action: 'READ' });
      const outOfRange = makeFullLog({
        id: 'out',
        timestamp: new Date('2024-01-01'),
        action: 'WRITE',
      });
      await storage.store(inRange);
      await storage.store(outOfRange);
      const report = await reporter.generateFromStorage(storage, period);
      expect(report.totalEvents).toBe(1);
      expect(report.byAction['READ']).toBe(1);
    });

    it('returns empty report when no logs match the period', async () => {
      const storage = new InMemoryAuditStorage();
      const report = await reporter.generateFromStorage(storage, period);
      expect(report.totalEvents).toBe(0);
    });
  });
});
