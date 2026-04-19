/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { EventNormalizer, CdcFilter, CdcTransformer, CdcProcessor } from './index.js';
import type { DebeziumRaw, PgRaw, MySqlRaw, MongoRaw, CdcEvent } from './index.js';

// ─── Raw event fixtures ───────────────────────────────────────────────────────

const debeziumInsert: DebeziumRaw = {
  kind: 'debezium',
  payload: {
    op: 'c',
    ts_ms: 1_700_000_000_000,
    source: { db: 'shop', table: 'orders' },
    before: null,
    after: { id: 1, total: 99.99 },
  },
};

const pgUpdate: PgRaw = {
  kind: 'postgres',
  lsn: '0/1600108',
  operation: 'UPDATE',
  schema: 'public',
  table: 'users',
  old: { id: 5, name: 'Alice' },
  new: { id: 5, name: 'Alicia' },
  commitTime: 1_700_000_001_000,
};

const mysqlDelete: MySqlRaw = {
  kind: 'mysql',
  binlogFile: 'binlog.000001',
  binlogPosition: 4096,
  type: 'DELETE_ROWS',
  database: 'ecommerce',
  table: 'cart',
  rows: [{ before: { id: 9, sku: 'ABC' }, after: undefined }],
  timestamp: 1_700_000_002_000,
};

const mongoInsert: MongoRaw = {
  kind: 'mongodb',
  _id: { _data: 'resume-token-abc' },
  operationType: 'insert',
  ns: { db: 'catalog', coll: 'products' },
  fullDocument: { _id: 'p1', name: 'Widget', price: 9.99 },
  documentKey: { _id: 'p1' },
  clusterTime: 1_700_000_003_000,
};

const mongoUpdate: MongoRaw = {
  kind: 'mongodb',
  _id: { _data: 'resume-token-def' },
  operationType: 'update',
  ns: { db: 'catalog', coll: 'products' },
  fullDocument: null,
  documentKey: { _id: 'p2' },
  updateDescription: { updatedFields: { price: 12.99 } },
  clusterTime: 1_700_000_004_000,
};

// ─── EventNormalizer ──────────────────────────────────────────────────────────

describe('EventNormalizer', () => {
  const norm = new EventNormalizer();

  it('normalizes Debezium insert', () => {
    const e = norm.normalize(debeziumInsert)!;
    expect(e.source).toBe('debezium');
    expect(e.database).toBe('shop');
    expect(e.table).toBe('orders');
    expect(e.operation).toBe('insert');
    expect(e.before).toBeNull();
    expect(e.after).toStrictEqual({ id: 1, total: 99.99 });
    expect(e.timestamp).toBe(1_700_000_000_000);
  });

  it('normalizes Debezium operation codes', () => {
    const ops: Array<[string, string]> = [
      ['c', 'insert'],
      ['u', 'update'],
      ['d', 'delete'],
      ['r', 'read'],
    ];
    for (const [op, expected] of ops) {
      const raw: DebeziumRaw = {
        ...debeziumInsert,
        payload: { ...debeziumInsert.payload, op: op as any },
      };
      expect(norm.normalize(raw)!.operation).toBe(expected);
    }
  });

  it('returns null for unknown Debezium op', () => {
    const raw: DebeziumRaw = {
      ...debeziumInsert,
      payload: { ...debeziumInsert.payload, op: 'x' as any },
    };
    expect(norm.normalize(raw)).toBeNull();
  });

  it('normalizes PostgreSQL update', () => {
    const e = norm.normalize(pgUpdate)!;
    expect(e.source).toBe('postgres');
    expect(e.database).toBe('public');
    expect(e.table).toBe('users');
    expect(e.operation).toBe('update');
    expect(e.before).toStrictEqual({ id: 5, name: 'Alice' });
    expect(e.after).toStrictEqual({ id: 5, name: 'Alicia' });
  });

  it('normalizes MySQL delete', () => {
    const e = norm.normalize(mysqlDelete)!;
    expect(e.source).toBe('mysql');
    expect(e.operation).toBe('delete');
    expect(e.before).toStrictEqual({ id: 9, sku: 'ABC' });
  });

  it('normalizes MongoDB insert with fullDocument', () => {
    const e = norm.normalize(mongoInsert)!;
    expect(e.source).toBe('mongodb');
    expect(e.database).toBe('catalog');
    expect(e.table).toBe('products');
    expect(e.operation).toBe('insert');
    expect(e.after).toStrictEqual({ _id: 'p1', name: 'Widget', price: 9.99 });
  });

  it('normalizes MongoDB update via updateDescription', () => {
    const e = norm.normalize(mongoUpdate)!;
    expect(e.operation).toBe('update');
    expect(e.after).toStrictEqual({ price: 12.99 });
  });
});

// ─── CdcFilter ────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<CdcEvent> = {}): CdcEvent {
  return {
    id: '1',
    source: 'postgres',
    database: 'db',
    table: 'orders',
    operation: 'insert',
    before: null,
    after: { id: 1 },
    timestamp: 0,
    ...overrides,
  };
}

describe('CdcFilter', () => {
  it('passes all events when no options set', () => {
    const f = new CdcFilter();
    expect(f.matches(makeEvent())).toBe(true);
  });

  it('includeTables allows matching table', () => {
    const f = new CdcFilter({ includeTables: ['orders'] });
    expect(f.matches(makeEvent({ table: 'orders' }))).toBe(true);
    expect(f.matches(makeEvent({ table: 'users' }))).toBe(false);
  });

  it('excludeTables blocks matching table', () => {
    const f = new CdcFilter({ excludeTables: ['audit'] });
    expect(f.matches(makeEvent({ table: 'orders' }))).toBe(true);
    expect(f.matches(makeEvent({ table: 'audit' }))).toBe(false);
  });

  it('includeOperations filters by operation', () => {
    const f = new CdcFilter({ includeOperations: ['insert'] });
    expect(f.matches(makeEvent({ operation: 'insert' }))).toBe(true);
    expect(f.matches(makeEvent({ operation: 'delete' }))).toBe(false);
  });

  it('database exact match filter', () => {
    const f = new CdcFilter({ database: 'shop' });
    expect(f.matches(makeEvent({ database: 'shop' }))).toBe(true);
    expect(f.matches(makeEvent({ database: 'other' }))).toBe(false);
  });

  it('filter() returns only matching events', () => {
    const f = new CdcFilter({ includeOperations: ['insert'] });
    const events = [makeEvent({ operation: 'insert' }), makeEvent({ operation: 'delete' })];
    expect(f.filter(events)).toHaveLength(1);
  });
});

// ─── CdcTransformer ───────────────────────────────────────────────────────────

describe('CdcTransformer', () => {
  it('renames fields according to fieldMappings', () => {
    const t = new CdcTransformer({ fieldMappings: { ssn: 'tax_id' } });
    const result = t.transform(makeEvent({ after: { ssn: '123', name: 'Bob' } }));
    expect(result.after).toStrictEqual({ tax_id: '123', name: 'Bob' });
  });

  it('masks specified fields with ***', () => {
    const t = new CdcTransformer({ maskFields: ['password'] });
    const result = t.transform(makeEvent({ after: { password: 'secret', id: 1 } }));
    expect(result.after?.['password']).toBe('***');
    expect(result.after?.['id']).toBe(1);
  });

  it('drops removed fields', () => {
    const t = new CdcTransformer({ dropFields: ['internal_flag'] });
    const result = t.transform(makeEvent({ after: { id: 1, internal_flag: true } }));
    expect('internal_flag' in (result.after ?? {})).toBe(false);
    expect(result.after?.['id']).toBe(1);
  });

  it('does not mutate the original event', () => {
    const t = new CdcTransformer({ maskFields: ['pw'] });
    const original = makeEvent({ after: { pw: 'secret' } });
    t.transform(original);
    expect(original.after?.['pw']).toBe('secret');
  });

  it('handles null before/after safely', () => {
    const t = new CdcTransformer({ maskFields: ['pw'] });
    const result = t.transform(makeEvent({ before: null, after: null }));
    expect(result.before).toBeNull();
    expect(result.after).toBeNull();
  });

  it('applies all transformations in order', () => {
    const t = new CdcTransformer({
      fieldMappings: { ssn: 'tax_id' },
      maskFields: ['tax_id'],
      dropFields: ['debug'],
    });
    const result = t.transform(makeEvent({ after: { ssn: '999', debug: true, name: 'Eve' } }));
    expect(result.after).toStrictEqual({ tax_id: '***', name: 'Eve' });
  });
});

// ─── CdcProcessor ─────────────────────────────────────────────────────────────

describe('CdcProcessor', () => {
  it('delivers normalized events to subscribers', () => {
    const processor = new CdcProcessor();
    const received: CdcEvent[] = [];
    processor.subscribe((e) => received.push(e));
    processor.ingest(debeziumInsert);
    expect(received).toHaveLength(1);
    expect(received[0]!.operation).toBe('insert');
  });

  it('filters events before delivery', () => {
    const processor = new CdcProcessor({
      filter: { includeOperations: ['delete'] },
    });
    const received: CdcEvent[] = [];
    processor.subscribe((e) => received.push(e));
    processor.ingest(debeziumInsert); // insert — filtered out
    processor.ingest(mysqlDelete); // delete — passes
    expect(received).toHaveLength(1);
    expect(received[0]!.operation).toBe('delete');
  });

  it('transforms events before delivery', () => {
    const processor = new CdcProcessor({ transform: { maskFields: ['total'] } });
    const received: CdcEvent[] = [];
    processor.subscribe((e) => received.push(e));
    processor.ingest(debeziumInsert);
    expect(received[0]!.after?.['total']).toBe('***');
  });

  it('increments processed counter for delivered events', () => {
    const processor = new CdcProcessor();
    processor.subscribe(() => undefined);
    processor.ingest(debeziumInsert);
    processor.ingest(pgUpdate);
    expect(processor.processed).toBe(2);
  });

  it('increments skipped counter for filtered events', () => {
    const processor = new CdcProcessor({ filter: { includeOperations: ['delete'] } });
    processor.subscribe(() => undefined);
    processor.ingest(debeziumInsert); // skipped
    processor.ingest(mysqlDelete); // processed
    expect(processor.processed).toBe(1);
    expect(processor.skipped).toBe(1);
  });

  it('ingestAll processes a batch', () => {
    const processor = new CdcProcessor();
    const handler = vi.fn();
    processor.subscribe(handler);
    processor.ingestAll([debeziumInsert, pgUpdate, mysqlDelete, mongoInsert]);
    expect(handler).toHaveBeenCalledTimes(4);
  });

  it('unsubscribing removes handler', () => {
    const processor = new CdcProcessor();
    const handler = vi.fn();
    const unsub = processor.subscribe(handler);
    unsub();
    processor.ingest(debeziumInsert);
    expect(handler).not.toHaveBeenCalled();
  });
});
