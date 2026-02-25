/**
 * A single row in a warehouse table — all columns are unknown at compile time.
 */
export type WarehouseRecord = Record<string, unknown>;

// ─── Schema types ─────────────────────────────────────────────────────────────

/** Supported column data types. */
export type ColumnType = 'string' | 'number' | 'boolean' | 'date' | 'json';

/** Definition of a single table column. */
export interface ColumnDefinition {
  readonly name: string;
  readonly type: ColumnType;
  readonly nullable: boolean;
  readonly defaultValue?: unknown;
}

/** Full schema of a warehouse table. */
export interface TableSchema {
  readonly tableName: string;
  readonly columns: ColumnDefinition[];
  readonly primaryKey?: string[];
}

// ─── Query types ──────────────────────────────────────────────────────────────

/** Result of executing a query. */
export interface QueryResult<T = WarehouseRecord> {
  readonly rows: T[];
  readonly rowCount: number;
  readonly executionMs: number;
}

/**
 * Injectable query executor — accepts a SQL string and optional parameters,
 * and returns the raw rows as an array of records.
 */
export type QueryExecutor = (sql: string, params?: unknown[]) => Promise<WarehouseRecord[]>;

// ─── Connector interface ──────────────────────────────────────────────────────

/** Contract all warehouse connectors must implement. */
export interface WarehouseConnector {
  /** Connector type identifier. */
  readonly type: string;
  /** Execute a raw SQL query. */
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  /** Insert rows into a table. */
  insert(table: string, rows: readonly WarehouseRecord[]): Promise<number>;
  /** Upsert rows (insert or update) using the given key columns. */
  upsert(table: string, rows: readonly WarehouseRecord[], keyColumns: string[]): Promise<number>;
  /** Delete rows matching a condition. */
  delete(table: string, condition: string, params?: unknown[]): Promise<number>;
  /** Check if a table exists. */
  tableExists(table: string): Promise<boolean>;
  /** Create a table from a schema definition. */
  createTable(schema: TableSchema): Promise<void>;
  /** Drop a table. */
  dropTable(table: string): Promise<void>;
}

// ─── Sync types ───────────────────────────────────────────────────────────────

/** Sync strategy mode. */
export type SyncMode = 'full_refresh' | 'incremental' | 'merge';

/** Options for a data sync operation. */
export interface SyncOptions {
  readonly mode: SyncMode;
  /** Number of rows per batch (default 1000). */
  readonly batchSize?: number;
  /** Column used to identify rows for incremental/merge syncs. */
  readonly keyColumn?: string;
  /** For incremental sync: only sync rows newer than this cursor value. */
  readonly cursor?: unknown;
}

/** Result of a data sync operation. */
export interface SyncResult {
  readonly inserted: number;
  readonly updated: number;
  readonly deleted: number;
  readonly failed: number;
  readonly durationMs: number;
}

// ─── Schema evolution types ───────────────────────────────────────────────────

/** Type of schema change. */
export type SchemaChangeType = 'add_column' | 'drop_column' | 'rename_column' | 'alter_column';

/** A single schema change to be applied. */
export interface SchemaChange {
  readonly type: SchemaChangeType;
  readonly tableName: string;
  /** Column being changed. */
  readonly columnName: string;
  /** New column definition (for `add_column` and `alter_column`). */
  readonly newColumn?: ColumnDefinition;
  /** New name (for `rename_column`). */
  readonly newName?: string;
}

/** Result of applying schema evolution changes. */
export interface SchemaEvolutionResult {
  readonly applied: number;
  readonly failed: number;
  readonly changes: ReadonlyArray<{ change: SchemaChange; success: boolean; error?: string }>;
}
