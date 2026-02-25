/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import {
  SnowflakeConnector,
  BigQueryConnector,
  RedshiftConnector,
  DataSyncManager,
  SchemaEvolutionManager,
} from './index.js';
import type { QueryExecutor, WarehouseRecord, TableSchema, SchemaChange } from './index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeExecutor(returnRows: WarehouseRecord[] = []): QueryExecutor {
  return vi.fn().mockResolvedValue(returnRows);
}

const schema: TableSchema = {
  tableName: 'users',
  columns: [
    { name: 'id', type: 'number', nullable: false },
    { name: 'name', type: 'string', nullable: true },
    { name: 'meta', type: 'json', nullable: true },
  ],
};

const row: WarehouseRecord = { id: 1, name: 'Alice' };

// ─── SnowflakeConnector ───────────────────────────────────────────────────────

describe('SnowflakeConnector', () => {
  const cfg = {
    account: 'acct',
    warehouse: 'wh',
    database: 'db',
    schema: 'public',
    executor: makeExecutor(),
  };

  it('type is "snowflake"', () => {
    expect(new SnowflakeConnector(cfg).type).toBe('snowflake');
  });

  it('query() returns rows and rowCount', async () => {
    const executor = makeExecutor([{ id: 1 }]);
    const c = new SnowflakeConnector({ ...cfg, executor });
    const result = await c.query('SELECT 1');
    expect(result.rows).toHaveLength(1);
    expect(result.rowCount).toBe(1);
    expect(result.executionMs).toBeGreaterThanOrEqual(0);
  });

  it('query() passes params to executor', async () => {
    const executor = makeExecutor();
    const c = new SnowflakeConnector({ ...cfg, executor });
    await c.query('SELECT $1', [42]);
    expect(executor).toHaveBeenCalledWith('SELECT $1', [42]);
  });

  it('insert() calls executor once per row', async () => {
    const executor = makeExecutor();
    const c = new SnowflakeConnector({ ...cfg, executor });
    await c.insert('users', [row, { id: 2, name: 'Bob' }]);
    expect(executor).toHaveBeenCalledTimes(2);
  });

  it('insert() returns the inserted row count', async () => {
    const executor = makeExecutor();
    const c = new SnowflakeConnector({ ...cfg, executor });
    expect(await c.insert('users', [row])).toBe(1);
  });

  it('insert() returns 0 for empty array', async () => {
    const executor = makeExecutor();
    const c = new SnowflakeConnector({ ...cfg, executor });
    expect(await c.insert('users', [])).toBe(0);
    expect(executor).not.toHaveBeenCalled();
  });

  it('upsert() uses MERGE INTO SQL', async () => {
    const executor = makeExecutor();
    const c = new SnowflakeConnector({ ...cfg, executor });
    await c.upsert('users', [row], ['id']);
    const sql = (executor as any).mock.calls[0][0] as string;
    expect(sql).toContain('MERGE INTO');
  });

  it('upsert() returns row count', async () => {
    const executor = makeExecutor();
    const c = new SnowflakeConnector({ ...cfg, executor });
    expect(await c.upsert('users', [row, { id: 2 }], ['id'])).toBe(2);
  });

  it('upsert() returns 0 for empty rows', async () => {
    const executor = makeExecutor();
    const c = new SnowflakeConnector({ ...cfg, executor });
    expect(await c.upsert('users', [], ['id'])).toBe(0);
  });

  it('delete() generates DELETE SQL', async () => {
    const executor = makeExecutor();
    const c = new SnowflakeConnector({ ...cfg, executor });
    await c.delete('users', 'id = $1', [1]);
    const sql = (executor as any).mock.calls[0][0] as string;
    expect(sql).toContain('DELETE FROM users');
    expect(sql).toContain('id = $1');
  });

  it('tableExists() returns true when count > 0', async () => {
    const executor = makeExecutor([{ cnt: 1 }]);
    const c = new SnowflakeConnector({ ...cfg, executor });
    expect(await c.tableExists('users')).toBe(true);
  });

  it('tableExists() returns false when count = 0', async () => {
    const executor = makeExecutor([{ cnt: 0 }]);
    const c = new SnowflakeConnector({ ...cfg, executor });
    expect(await c.tableExists('users')).toBe(false);
  });

  it('tableExists() returns false when no rows returned', async () => {
    const executor = makeExecutor([]);
    const c = new SnowflakeConnector({ ...cfg, executor });
    expect(await c.tableExists('users')).toBe(false);
  });

  it('createTable() generates CREATE TABLE IF NOT EXISTS', async () => {
    const executor = makeExecutor();
    const c = new SnowflakeConnector({ ...cfg, executor });
    await c.createTable(schema);
    const sql = (executor as any).mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(sql).toContain('VARIANT'); // json → VARIANT in Snowflake
  });

  it('dropTable() generates DROP TABLE IF EXISTS', async () => {
    const executor = makeExecutor();
    const c = new SnowflakeConnector({ ...cfg, executor });
    await c.dropTable('users');
    const sql = (executor as any).mock.calls[0][0] as string;
    expect(sql).toContain('DROP TABLE IF EXISTS users');
  });
});

// ─── BigQueryConnector ────────────────────────────────────────────────────────

describe('BigQueryConnector', () => {
  const cfg = { projectId: 'my-project', dataset: 'analytics', executor: makeExecutor() };

  it('type is "bigquery"', () => {
    expect(new BigQueryConnector(cfg).type).toBe('bigquery');
  });

  it('qualifyTable() returns project.dataset.table', () => {
    const c = new BigQueryConnector(cfg);
    expect(c.qualifyTable('events')).toBe('my-project.analytics.events');
  });

  it('upsert() uses MERGE SQL', async () => {
    const executor = makeExecutor();
    const c = new BigQueryConnector({ ...cfg, executor });
    await c.upsert('events', [row], ['id']);
    const sql = (executor as any).mock.calls[0][0] as string;
    expect(sql).toContain('MERGE INTO');
  });

  it('createTable() uses FLOAT64 for number columns', async () => {
    const executor = makeExecutor();
    const c = new BigQueryConnector({ ...cfg, executor });
    await c.createTable(schema);
    const sql = (executor as any).mock.calls[0][0] as string;
    expect(sql).toContain('FLOAT64');
  });

  it('createTable() uses JSON for json columns', async () => {
    const executor = makeExecutor();
    const c = new BigQueryConnector({ ...cfg, executor });
    await c.createTable(schema);
    const sql = (executor as any).mock.calls[0][0] as string;
    expect(sql).toContain('JSON');
  });

  it('createTable() uses BOOL for boolean columns', async () => {
    const executor = makeExecutor();
    const c = new BigQueryConnector({ ...cfg, executor });
    const boolSchema: TableSchema = {
      tableName: 'flags',
      columns: [{ name: 'active', type: 'boolean', nullable: true }],
    };
    await c.createTable(boolSchema);
    const sql = (executor as any).mock.calls[0][0] as string;
    expect(sql).toContain('BOOL');
  });
});

// ─── RedshiftConnector ────────────────────────────────────────────────────────

describe('RedshiftConnector', () => {
  const cfg = {
    host: 'cluster.redshift.amazonaws.com',
    database: 'dev',
    schema: 'public',
    executor: makeExecutor(),
  };

  it('type is "redshift"', () => {
    expect(new RedshiftConnector(cfg).type).toBe('redshift');
  });

  it('upsert() uses INSERT … ON CONFLICT SQL', async () => {
    const executor = makeExecutor();
    const c = new RedshiftConnector({ ...cfg, executor });
    await c.upsert('users', [row], ['id']);
    const sql = (executor as any).mock.calls[0][0] as string;
    expect(sql).toContain('ON CONFLICT');
    expect(sql).not.toContain('MERGE');
  });

  it('upsert() DO NOTHING when no non-key columns', async () => {
    const executor = makeExecutor();
    const c = new RedshiftConnector({ ...cfg, executor });
    await c.upsert('users', [{ id: 1 }], ['id']);
    const sql = (executor as any).mock.calls[0][0] as string;
    expect(sql).toContain('DO NOTHING');
  });

  it('createTable() uses SUPER for json columns', async () => {
    const executor = makeExecutor();
    const c = new RedshiftConnector({ ...cfg, executor });
    await c.createTable(schema);
    const sql = (executor as any).mock.calls[0][0] as string;
    expect(sql).toContain('SUPER');
  });
});

// ─── DataSyncManager ──────────────────────────────────────────────────────────

function makeConnector() {
  return {
    type: 'mock',
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, executionMs: 0 }),
    insert: vi.fn().mockImplementation(async (_t: string, rows: WarehouseRecord[]) => rows.length),
    upsert: vi.fn().mockImplementation(async (_t: string, rows: WarehouseRecord[]) => rows.length),
    delete: vi.fn().mockResolvedValue(5),
    tableExists: vi.fn().mockResolvedValue(true),
    createTable: vi.fn().mockResolvedValue(undefined),
    dropTable: vi.fn().mockResolvedValue(undefined),
  };
}

describe('DataSyncManager', () => {
  const mgr = new DataSyncManager();

  it('full_refresh: deletes all rows then inserts source', async () => {
    const connector = makeConnector();
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = await mgr.sync(connector, rows, 'users', { mode: 'full_refresh' });
    expect(connector.delete).toHaveBeenCalledWith('users', '1=1');
    expect(connector.insert).toHaveBeenCalled();
    expect(result.inserted).toBe(3);
    expect(result.deleted).toBe(5);
  });

  it('full_refresh: batches inserts when batchSize is set', async () => {
    const connector = makeConnector();
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    await mgr.sync(connector, rows, 't', { mode: 'full_refresh', batchSize: 2 });
    expect(connector.insert).toHaveBeenCalledTimes(2);
  });

  it('incremental: inserts only rows newer than cursor', async () => {
    const connector = makeConnector();
    const rows = [{ id: 1 }, { id: 5 }, { id: 10 }];
    const result = await mgr.sync(connector, rows, 't', {
      mode: 'incremental',
      keyColumn: 'id',
      cursor: 3,
    });
    expect(result.inserted).toBe(2); // id=5 and id=10
  });

  it('incremental: inserts all rows when no cursor', async () => {
    const connector = makeConnector();
    const rows = [{ id: 1 }, { id: 2 }];
    const result = await mgr.sync(connector, rows, 't', { mode: 'incremental' });
    expect(result.inserted).toBe(2);
  });

  it('merge: calls upsert with key columns', async () => {
    const connector = makeConnector();
    const rows = [{ id: 1 }, { id: 2 }];
    const result = await mgr.sync(connector, rows, 'users', { mode: 'merge', keyColumn: 'id' });
    expect(connector.upsert).toHaveBeenCalledWith('users', rows, ['id']);
    expect(result.updated).toBe(2);
  });

  it('merge: uses empty keyColumns when keyColumn not set', async () => {
    const connector = makeConnector();
    await mgr.sync(connector, [{ id: 1 }], 'users', { mode: 'merge' });
    expect(connector.upsert).toHaveBeenCalledWith('users', [{ id: 1 }], []);
  });

  it('result contains durationMs >= 0', async () => {
    const connector = makeConnector();
    const result = await mgr.sync(connector, [], 't', { mode: 'full_refresh' });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('empty source with full_refresh still calls delete', async () => {
    const connector = makeConnector();
    const result = await mgr.sync(connector, [], 'users', { mode: 'full_refresh' });
    expect(connector.delete).toHaveBeenCalled();
    expect(result.inserted).toBe(0);
  });
});

// ─── SchemaEvolutionManager ───────────────────────────────────────────────────

describe('SchemaEvolutionManager', () => {
  const mgr = new SchemaEvolutionManager();

  const base: TableSchema = {
    tableName: 'users',
    columns: [
      { name: 'id', type: 'number', nullable: false },
      { name: 'name', type: 'string', nullable: true },
    ],
  };

  it('generateDiff() detects added columns', () => {
    const target: TableSchema = {
      ...base,
      columns: [...base.columns, { name: 'email', type: 'string', nullable: true }],
    };
    const diff = mgr.generateDiff(base, target);
    expect(diff).toContainEqual(
      expect.objectContaining({ type: 'add_column', columnName: 'email' }),
    );
  });

  it('generateDiff() detects dropped columns', () => {
    const target: TableSchema = { ...base, columns: [base.columns[0]!] };
    const diff = mgr.generateDiff(base, target);
    expect(diff).toContainEqual(
      expect.objectContaining({ type: 'drop_column', columnName: 'name' }),
    );
  });

  it('generateDiff() detects altered column types', () => {
    const target: TableSchema = {
      ...base,
      columns: [
        { name: 'id', type: 'string', nullable: false }, // type changed
        base.columns[1]!,
      ],
    };
    const diff = mgr.generateDiff(base, target);
    expect(diff).toContainEqual(
      expect.objectContaining({ type: 'alter_column', columnName: 'id' }),
    );
  });

  it('generateDiff() returns empty when schemas are identical', () => {
    expect(mgr.generateDiff(base, base)).toHaveLength(0);
  });

  it('generateDiff() detects multiple changes at once', () => {
    const target: TableSchema = {
      ...base,
      columns: [
        { name: 'id', type: 'string', nullable: false }, // altered
        { name: 'email', type: 'string', nullable: true }, // added; 'name' dropped
      ],
    };
    const diff = mgr.generateDiff(base, target);
    const types = diff.map((d) => d.type);
    expect(types).toContain('add_column');
    expect(types).toContain('drop_column');
    expect(types).toContain('alter_column');
  });

  it('apply() applies all changes and returns correct applied count', async () => {
    const connector = {
      type: 'mock',
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, executionMs: 0 }),
      insert: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      tableExists: vi.fn(),
      createTable: vi.fn(),
      dropTable: vi.fn(),
    };
    const changes: SchemaChange[] = [
      {
        type: 'add_column',
        tableName: 'users',
        columnName: 'email',
        newColumn: { name: 'email', type: 'string', nullable: true },
      },
      { type: 'drop_column', tableName: 'users', columnName: 'old_col' },
    ];
    const result = await mgr.apply(connector, changes);
    expect(result.applied).toBe(2);
    expect(result.failed).toBe(0);
    expect(connector.query).toHaveBeenCalledTimes(2);
  });

  it('apply() captures errors without throwing', async () => {
    const connector = {
      type: 'mock',
      query: vi.fn().mockRejectedValue(new Error('DDL failed')),
      insert: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      tableExists: vi.fn(),
      createTable: vi.fn(),
      dropTable: vi.fn(),
    };
    const changes: SchemaChange[] = [{ type: 'drop_column', tableName: 'users', columnName: 'x' }];
    const result = await mgr.apply(connector, changes);
    expect(result.applied).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.changes[0]?.error).toContain('DDL failed');
  });

  it('apply() continues after partial failure', async () => {
    let calls = 0;
    const connector = {
      type: 'mock',
      query: vi.fn().mockImplementation(async () => {
        calls++;
        if (calls === 1) throw new Error('first fails');
        return { rows: [], rowCount: 0, executionMs: 0 };
      }),
      insert: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      tableExists: vi.fn(),
      createTable: vi.fn(),
      dropTable: vi.fn(),
    };
    const changes: SchemaChange[] = [
      { type: 'drop_column', tableName: 't', columnName: 'a' },
      { type: 'drop_column', tableName: 't', columnName: 'b' },
    ];
    const result = await mgr.apply(connector, changes);
    expect(result.applied).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('apply() generates ADD COLUMN SQL', async () => {
    const executor = vi.fn().mockResolvedValue({ rows: [], rowCount: 0, executionMs: 0 });
    const connector = {
      type: 'mock',
      query: executor,
      insert: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      tableExists: vi.fn(),
      createTable: vi.fn(),
      dropTable: vi.fn(),
    };
    const change: SchemaChange = {
      type: 'add_column',
      tableName: 'users',
      columnName: 'email',
      newColumn: { name: 'email', type: 'string', nullable: true },
    };
    await mgr.apply(connector, [change]);
    const sql = executor.mock.calls[0]![0] as string;
    expect(sql).toContain('ADD COLUMN email');
    expect(sql).toContain('STRING');
  });

  it('apply() generates DROP COLUMN SQL', async () => {
    const executor = vi.fn().mockResolvedValue({ rows: [], rowCount: 0, executionMs: 0 });
    const connector = {
      type: 'mock',
      query: executor,
      insert: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      tableExists: vi.fn(),
      createTable: vi.fn(),
      dropTable: vi.fn(),
    };
    const change: SchemaChange = { type: 'drop_column', tableName: 'users', columnName: 'old' };
    await mgr.apply(connector, [change]);
    const sql = executor.mock.calls[0]![0] as string;
    expect(sql).toContain('DROP COLUMN old');
  });

  it('apply() generates RENAME COLUMN SQL', async () => {
    const executor = vi.fn().mockResolvedValue({ rows: [], rowCount: 0, executionMs: 0 });
    const connector = {
      type: 'mock',
      query: executor,
      insert: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      tableExists: vi.fn(),
      createTable: vi.fn(),
      dropTable: vi.fn(),
    };
    const change: SchemaChange = {
      type: 'rename_column',
      tableName: 'users',
      columnName: 'nm',
      newName: 'name',
    };
    await mgr.apply(connector, [change]);
    const sql = executor.mock.calls[0]![0] as string;
    expect(sql).toContain('RENAME COLUMN nm TO name');
  });

  it('apply() with empty changes returns applied=0', async () => {
    const connector = {
      type: 'mock',
      query: vi.fn(),
      insert: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      tableExists: vi.fn(),
      createTable: vi.fn(),
      dropTable: vi.fn(),
    };
    const result = await mgr.apply(connector, []);
    expect(result.applied).toBe(0);
    expect(result.failed).toBe(0);
  });
});
