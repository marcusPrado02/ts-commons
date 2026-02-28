import type {
  CdcEvent,
  CdcRawEvent,
  CdcOperation,
  DebeziumRaw,
  PgRaw,
  MySqlRaw,
  MongoRaw,
} from './types.js';

/** Monotonic counter to generate unique IDs when the source doesn't provide one. */
let seq = 0;
function nextId(): string {
  return `cdc-${++seq}`;
}

const DEBEZIUM_OP_MAP: Record<string, CdcOperation> = {
  c: 'insert',
  u: 'update',
  d: 'delete',
  r: 'read',
};

const PG_OP_MAP: Record<string, CdcOperation> = {
  INSERT: 'insert',
  UPDATE: 'update',
  DELETE: 'delete',
};

const MYSQL_OP_MAP: Record<string, CdcOperation> = {
  WRITE_ROWS: 'insert',
  UPDATE_ROWS: 'update',
  DELETE_ROWS: 'delete',
};

const MONGO_OP_MAP: Record<string, CdcOperation> = {
  insert: 'insert',
  update: 'update',
  delete: 'delete',
  replace: 'update',
};

/**
 * Converts source-specific {@link CdcRawEvent} payloads into the canonical
 * {@link CdcEvent} format.
 *
 * Supports Debezium, PostgreSQL logical replication, MySQL binlog and
 * MongoDB change streams.
 */
export class EventNormalizer {
  /**
   * Normalise a raw event. Returns `null` if the event cannot be mapped
   * (e.g. unknown operation code).
   */
  normalize(raw: CdcRawEvent): CdcEvent | null {
    if (raw.kind === 'debezium') return this.fromDebezium(raw);
    if (raw.kind === 'postgres') return this.fromPostgres(raw);
    if (raw.kind === 'mysql') return this.fromMySql(raw);
    return this.fromMongo(raw);
  }

  private fromDebezium(raw: DebeziumRaw): CdcEvent | null {
    const op = DEBEZIUM_OP_MAP[raw.payload.op];
    if (op === undefined) return null;
    return {
      id: nextId(),
      source: 'debezium',
      database: raw.payload.source.db,
      table: raw.payload.source.table,
      operation: op,
      before: raw.payload.before,
      after: raw.payload.after,
      timestamp: raw.payload.ts_ms,
    };
  }

  private fromPostgres(raw: PgRaw): CdcEvent | null {
    const op = PG_OP_MAP[raw.operation];
    if (op === undefined) return null;
    return {
      id: nextId(),
      source: 'postgres',
      database: raw.schema,
      table: raw.table,
      operation: op,
      before: raw.old,
      after: raw.new,
      timestamp: raw.commitTime,
    };
  }

  private fromMySql(raw: MySqlRaw): CdcEvent | null {
    const op = MYSQL_OP_MAP[raw.type];
    if (op === undefined) return null;
    const firstRow = raw.rows[0];
    return {
      id: nextId(),
      source: 'mysql',
      database: raw.database,
      table: raw.table,
      operation: op,
      before: firstRow?.before ?? null,
      after: firstRow?.after ?? null,
      timestamp: raw.timestamp,
    };
  }

  private fromMongo(raw: MongoRaw): CdcEvent | null {
    const op = MONGO_OP_MAP[raw.operationType];
    if (op === undefined) return null;
    const after = raw.fullDocument ?? buildMongoAfter(raw);
    return {
      id: nextId(),
      source: 'mongodb',
      database: raw.ns.db,
      table: raw.ns.coll,
      operation: op,
      before: null,
      after,
      timestamp: raw.clusterTime,
    };
  }
}

function buildMongoAfter(raw: MongoRaw): Record<string, unknown> | null {
  if (raw.updateDescription?.updatedFields !== undefined) {
    return raw.updateDescription.updatedFields;
  }
  return null;
}
