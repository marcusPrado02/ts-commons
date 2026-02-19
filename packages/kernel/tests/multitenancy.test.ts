/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, beforeEach } from 'vitest';

import { TenantContext } from '../src/multitenancy/TenantContext';
import { TenantIsolationStrategy } from '../src/multitenancy/TenantIsolation';
import type { TenantIsolationDescriptor } from '../src/multitenancy/TenantIsolation';
import { AbstractTenantAwareRepository } from '../src/multitenancy/TenantAwareRepository';
import type { TenantAwareRepository } from '../src/multitenancy/TenantAwareRepository';
import {
  InMemoryTenantLogger,
  InMemoryTenantMetrics,
} from '../src/multitenancy/TenantObservability';
import { TenantId } from '../src/identity/TenantId';
import { Entity } from '../src/ddd/Entity';
import { Specification } from '../src/ddd/Specification';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

class TestEntity extends Entity<string> {
  public constructor(id: string, public readonly name: string) {
    super(id);
  }
}

class NameSpecification extends Specification<TestEntity> {
  constructor(private readonly expected: string) {
    super();
  }

  isSatisfiedBy(entity: TestEntity): boolean {
    return entity.name === this.expected;
  }
}

class InMemoryTestRepository extends AbstractTenantAwareRepository<TestEntity, string> {
  readonly isolation: TenantIsolationDescriptor = {
    strategy: TenantIsolationStrategy.ROW_PER_TENANT,
    discriminatorField: 'tenantId',
  };

  private readonly store = new Map<string, Map<string, TestEntity>>();

  private bucket(tenantId: TenantId): Map<string, TestEntity> {
    const key = tenantId.value;
    if (!this.store.has(key)) this.store.set(key, new Map());
    return this.store.get(key)!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  }

  findById(tenantId: TenantId, id: string): Promise<TestEntity | undefined> {
    return Promise.resolve(this.bucket(tenantId).get(id));
  }

  findBy(tenantId: TenantId, spec: Specification<TestEntity>): Promise<TestEntity[]> {
    const results = [...this.bucket(tenantId).values()].filter((e) =>
      spec.isSatisfiedBy(e),
    );
    return Promise.resolve(results);
  }

  save(tenantId: TenantId, entity: TestEntity): Promise<void> {
    this.bucket(tenantId).set(entity.id, entity);
    return Promise.resolve();
  }

  delete(tenantId: TenantId, id: string): Promise<void> {
    this.bucket(tenantId).delete(id);
    return Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Suite 1 — TenantContext
// ---------------------------------------------------------------------------

describe('TenantContext', () => {
  const acme = TenantId.create('acme');
  const globex = TenantId.create('globex');

  it('current() returns none outside any run scope', () => {
    const result = TenantContext.current();
    expect(result.isNone()).toBe(true);
  });

  it('hasTenant() returns false outside any run scope', () => {
    expect(TenantContext.hasTenant()).toBe(false);
  });

  it('run() makes current() return the given tenant', () => {
    TenantContext.run(acme, () => {
      const current = TenantContext.current();
      expect(current.isSome()).toBe(true);
      expect(current.unwrap().value).toBe('acme');
    });
  });

  it('hasTenant() returns true inside run()', () => {
    TenantContext.run(acme, () => {
      expect(TenantContext.hasTenant()).toBe(true);
    });
  });

  it('nested run() scopes override the parent context', () => {
    TenantContext.run(acme, () => {
      TenantContext.run(globex, () => {
        expect(TenantContext.current().unwrap().value).toBe('globex');
      });
      // outer scope is restored
      expect(TenantContext.current().unwrap().value).toBe('acme');
    });
  });

  it('context does not leak between sibling runs', () => {
    TenantContext.run(acme, () => { /* no-op */ });
    expect(TenantContext.hasTenant()).toBe(false);
  });

  it('run() propagates context through async boundaries', async () => {
    const result = await TenantContext.run(acme, async () => {
      await Promise.resolve();
      return TenantContext.current().unwrap().value;
    });
    expect(result).toBe('acme');
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — TenantIsolationStrategy
// ---------------------------------------------------------------------------

describe('TenantIsolationStrategy', () => {
  it('has the three canonical enum values', () => {
    expect(TenantIsolationStrategy.DATABASE_PER_TENANT).toBe('database_per_tenant');
    expect(TenantIsolationStrategy.SCHEMA_PER_TENANT).toBe('schema_per_tenant');
    expect(TenantIsolationStrategy.ROW_PER_TENANT).toBe('row_per_tenant');
  });

  it('TenantIsolationDescriptor can carry a discriminatorField', () => {
    const descriptor: TenantIsolationDescriptor = {
      strategy: TenantIsolationStrategy.ROW_PER_TENANT,
      discriminatorField: 'tenant_id',
    };
    expect(descriptor.discriminatorField).toBe('tenant_id');
  });

  it('TenantIsolationDescriptor does not require discriminatorField', () => {
    const descriptor: TenantIsolationDescriptor = {
      strategy: TenantIsolationStrategy.DATABASE_PER_TENANT,
    };
    expect(descriptor.discriminatorField).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — TenantAwareRepository
// ---------------------------------------------------------------------------

describe('TenantAwareRepository (InMemoryTestRepository)', () => {
  let repo: TenantAwareRepository<TestEntity, string>;
  const acme = TenantId.create('acme');
  const globex = TenantId.create('globex');

  beforeEach(() => {
    repo = new InMemoryTestRepository();
  });

  it('stores and retrieves an entity by id', async () => {
    const entity = new TestEntity('1', 'Alice');
    await repo.save(acme, entity);
    const found = await repo.findById(acme, '1');
    expect(found?.name).toBe('Alice');
  });

  it('findById returns undefined for unknown id', async () => {
    const found = await repo.findById(acme, 'nope');
    expect(found).toBeUndefined();
  });

  it('tenant isolation — entities from one tenant are not visible to another', async () => {
    await repo.save(acme, new TestEntity('1', 'Alice'));
    const found = await repo.findById(globex, '1');
    expect(found).toBeUndefined();
  });

  it('findBy returns entities that satisfy the specification', async () => {
    await repo.save(acme, new TestEntity('1', 'Alice'));
    await repo.save(acme, new TestEntity('2', 'Bob'));
    const results = await repo.findBy(acme, new NameSpecification('Alice'));
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Alice');
  });

  it('delete removes an entity', async () => {
    await repo.save(acme, new TestEntity('1', 'Alice'));
    await repo.delete(acme, '1');
    const found = await repo.findById(acme, '1');
    expect(found).toBeUndefined();
  });

  it('exists() returns true when a matching entity is present', async () => {
    await repo.save(acme, new TestEntity('1', 'Alice'));
    const present = await repo.exists(acme, new NameSpecification('Alice'));
    expect(present).toBe(true);
  });

  it('exists() returns false when no entity matches', async () => {
    const present = await repo.exists(acme, new NameSpecification('Ghost'));
    expect(present).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — TenantObservability
// ---------------------------------------------------------------------------

describe('TenantObservability', () => {
  const acme = TenantId.create('acme');
  const globex = TenantId.create('globex');

  describe('InMemoryTenantLogger', () => {
    it('records log entries with the correct tenantId', () => {
      const logger = new InMemoryTenantLogger();
      logger.log(acme, { level: 'info', message: 'hello' });
      expect(logger.entries).toHaveLength(1);
      expect(logger.entries[0]?.tenantId).toBe('acme');
      expect(logger.entries[0]?.message).toBe('hello');
    });

    it('forTenant() filters entries by tenant', () => {
      const logger = new InMemoryTenantLogger();
      logger.log(acme, { level: 'info', message: 'acme msg' });
      logger.log(globex, { level: 'warn', message: 'globex msg' });
      expect(logger.forTenant(acme)).toHaveLength(1);
      expect(logger.forTenant(globex)[0]?.level).toBe('warn');
    });

    it('stores the optional context object', () => {
      const logger = new InMemoryTenantLogger();
      logger.log(acme, { level: 'error', message: 'boom', context: { code: 42 } });
      expect(logger.entries[0]?.context).toEqual({ code: 42 });
    });
  });

  describe('InMemoryTenantMetrics', () => {
    it('records metric samples with the correct tenantId', () => {
      const metrics = new InMemoryTenantMetrics();
      metrics.record(acme, { metric: 'req.count', value: 1 });
      expect(metrics.samples).toHaveLength(1);
      expect(metrics.samples[0]?.tenantId).toBe('acme');
    });

    it('forTenant() filters samples by tenant', () => {
      const metrics = new InMemoryTenantMetrics();
      metrics.record(acme, { metric: 'req.count', value: 1 });
      metrics.record(globex, { metric: 'req.count', value: 5 });
      expect(metrics.forTenant(acme)).toHaveLength(1);
      expect(metrics.forTenant(globex)[0]?.value).toBe(5);
    });

    it('stores optional tags', () => {
      const metrics = new InMemoryTenantMetrics();
      metrics.record(acme, { metric: 'latency', value: 12, tags: { region: 'eu' } });
      expect(metrics.samples[0]?.tags).toEqual({ region: 'eu' });
    });
  });
});
