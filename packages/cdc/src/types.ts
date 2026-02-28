/**
 * SQL / NoSQL operations captured by CDC.
 */
export type CdcOperation = 'insert' | 'update' | 'delete' | 'read';

/**
 * Origin system that produced the raw event.
 */
export type SourceType = 'debezium' | 'postgres' | 'mysql' | 'mongodb';

/**
 * The canonical CDC event format used throughout the pipeline.
 */
export interface CdcEvent {
  /** Unique identifier for this event (sourced from the connector). */
  readonly id: string;
  /** Source system type. */
  readonly source: SourceType;
  /** Database / schema name. */
  readonly database: string;
  /** Table / collection name. */
  readonly table: string;
  /** The DML operation. */
  readonly operation: CdcOperation;
  /** Row state before the change (null for inserts). */
  readonly before: Record<string, unknown> | null;
  /** Row state after the change (null for deletes). */
  readonly after: Record<string, unknown> | null;
  /** Epoch milliseconds when the change occurred at the source. */
  readonly timestamp: number;
}

/**
 * Source-specific raw payload emitted by a CDC connector.
 * Different connectors use different envelope shapes.
 */
export type CdcRawEvent = DebeziumRaw | PgRaw | MySqlRaw | MongoRaw;

/** Debezium Kafka Connect envelope */
export interface DebeziumRaw {
  readonly kind: 'debezium';
  readonly payload: {
    readonly op: 'c' | 'u' | 'd' | 'r';
    readonly ts_ms: number;
    readonly source: { readonly db: string; readonly table: string };
    readonly before: Record<string, unknown> | null;
    readonly after: Record<string, unknown> | null;
  };
}

/** PostgreSQL logical replication message */
export interface PgRaw {
  readonly kind: 'postgres';
  readonly lsn: string;
  readonly operation: 'INSERT' | 'UPDATE' | 'DELETE';
  readonly schema: string;
  readonly table: string;
  readonly old: Record<string, unknown> | null;
  readonly new: Record<string, unknown> | null;
  readonly commitTime: number;
}

/** MySQL binlog event */
export interface MySqlRaw {
  readonly kind: 'mysql';
  readonly binlogFile: string;
  readonly binlogPosition: number;
  readonly type: 'WRITE_ROWS' | 'UPDATE_ROWS' | 'DELETE_ROWS';
  readonly database: string;
  readonly table: string;
  readonly rows: {
    readonly before?: Record<string, unknown>;
    readonly after?: Record<string, unknown>;
  }[];
  readonly timestamp: number;
}

/** MongoDB change stream document */
export interface MongoRaw {
  readonly kind: 'mongodb';
  readonly _id: { _data: string };
  readonly operationType: 'insert' | 'update' | 'delete' | 'replace';
  readonly ns: { db: string; coll: string };
  readonly fullDocument?: Record<string, unknown> | null;
  readonly documentKey: { _id: unknown };
  readonly updateDescription?: { updatedFields?: Record<string, unknown> };
  readonly clusterTime: number;
}

/**
 * Criteria for filtering CDC events.
 */
export interface FilterOptions {
  /** Include only events from these tables (glob: '*' matches all). */
  readonly includeTables?: string[];
  /** Exclude events from these tables. */
  readonly excludeTables?: string[];
  /** Include only these operation types. */
  readonly includeOperations?: CdcOperation[];
  /** Only include events from this database. */
  readonly database?: string;
}

/**
 * Transformation instructions applied to a {@link CdcEvent}.
 */
export interface TransformOptions {
  /** Rename fields in before/after payloads. */
  readonly fieldMappings?: Record<string, string>;
  /** Mask (replace with `***`) the listed fields. */
  readonly maskFields?: string[];
  /** Drop the listed fields from before/after payloads. */
  readonly dropFields?: string[];
}
