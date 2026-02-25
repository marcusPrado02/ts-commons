import type {
  WarehouseConnector,
  QueryExecutor,
  QueryResult,
  WarehouseRecord,
  TableSchema,
  ColumnType,
} from '../types.js';

/** Partial sync result without timing (added by the caller). */
export type InnerSyncCounts = {
  inserted: number;
  updated: number;
  deleted: number;
  failed: number;
};

/**
 * Abstract base class providing common warehouse operations.
 * Subclasses override {@link upsertRow} and {@link mapColumnType} for dialect-specific SQL.
 */
export abstract class BaseConnector implements WarehouseConnector {
  abstract readonly type: string;

  constructor(protected readonly executor: QueryExecutor) {}

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const start = Date.now();
    const rows = await this.executor(sql, params);
    return { rows, rowCount: rows.length, executionMs: Date.now() - start };
  }

  async insert(table: string, rows: readonly WarehouseRecord[]): Promise<number> {
    if (rows.length === 0) return 0;
    for (const row of rows) {
      const cols = Object.keys(row);
      const vals = Object.values(row);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      await this.executor(
        `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
        vals,
      );
    }
    return rows.length;
  }

  async upsert(
    table: string,
    rows: readonly WarehouseRecord[],
    keyColumns: string[],
  ): Promise<number> {
    if (rows.length === 0) return 0;
    for (const row of rows) {
      await this.upsertRow(table, row, keyColumns);
    }
    return rows.length;
  }

  async delete(table: string, condition: string, params?: unknown[]): Promise<number> {
    const rows = await this.executor(`DELETE FROM ${table} WHERE ${condition}`, params);
    return rows.length;
  }

  async tableExists(table: string): Promise<boolean> {
    const rows = await this.executor(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_name = $1`,
      [table],
    );
    const cnt = rows[0]?.['cnt'];
    return cnt !== undefined && Number(cnt) > 0;
  }

  async createTable(schema: TableSchema): Promise<void> {
    const colDefs = schema.columns
      .map((c) => `${c.name} ${this.mapColumnType(c.type)}${c.nullable ? '' : ' NOT NULL'}`)
      .join(', ');
    await this.executor(`CREATE TABLE IF NOT EXISTS ${schema.tableName} (${colDefs})`);
  }

  async dropTable(table: string): Promise<void> {
    await this.executor(`DROP TABLE IF EXISTS ${table}`);
  }

  // ── Abstract / overridable ─────────────────────────────────────────────────

  /** Generate and execute dialect-specific upsert SQL for a single row. */
  protected abstract upsertRow(
    table: string,
    row: WarehouseRecord,
    keyColumns: string[],
  ): Promise<void>;

  /** Map a generic {@link ColumnType} to the dialect-specific SQL type keyword. */
  protected mapColumnType(type: ColumnType): string {
    const map: Record<ColumnType, string> = {
      string: 'VARCHAR',
      number: 'NUMERIC',
      boolean: 'BOOLEAN',
      date: 'TIMESTAMP',
      json: 'TEXT',
    };
    return map[type];
  }

  // ── Protected helpers ──────────────────────────────────────────────────────

  /** Build a MERGE SQL statement (Snowflake / BigQuery style). */
  protected buildMergeSql(table: string, row: WarehouseRecord, keyColumns: string[]): string {
    const cols = Object.keys(row);
    const selections = cols.map((c, i) => `$${i + 1} AS ${c}`).join(', ');
    const onClause = keyColumns.map((k) => `t.${k} = s.${k}`).join(' AND ');
    const updateSet = cols
      .filter((c) => !keyColumns.includes(c))
      .map((c) => `t.${c} = s.${c}`)
      .join(', ');
    const insertCols = cols.join(', ');
    const insertVals = cols.map((c) => `s.${c}`).join(', ');
    return [
      `MERGE INTO ${table} AS t`,
      `USING (SELECT ${selections}) AS s`,
      `ON (${onClause})`,
      updateSet.length > 0 ? `WHEN MATCHED THEN UPDATE SET ${updateSet}` : '',
      `WHEN NOT MATCHED THEN INSERT (${insertCols}) VALUES (${insertVals})`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  /** Build an INSERT … ON CONFLICT … DO UPDATE SET SQL (Redshift / PostgreSQL style). */
  protected buildUpsertSql(table: string, row: WarehouseRecord, keyColumns: string[]): string {
    const cols = Object.keys(row);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    const conflictCols = keyColumns.join(', ');
    const updateSet = cols
      .filter((c) => !keyColumns.includes(c))
      .map((c) => `${c} = EXCLUDED.${c}`)
      .join(', ');
    const insertSql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
    if (updateSet.length === 0) {
      return `${insertSql} ON CONFLICT (${conflictCols}) DO NOTHING`;
    }
    return `${insertSql} ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateSet}`;
  }
}
