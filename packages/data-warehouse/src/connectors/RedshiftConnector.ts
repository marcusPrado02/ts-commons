import type { QueryExecutor, WarehouseRecord, ColumnType } from '../types.js';
import { BaseConnector } from './BaseConnector.js';

/** Connection configuration for Amazon Redshift. */
export interface RedshiftConfig {
  readonly host: string;
  readonly database: string;
  readonly schema: string;
  readonly executor: QueryExecutor;
}

/**
 * Warehouse connector for **Amazon Redshift**.
 *
 * Uses `INSERT … ON CONFLICT … DO UPDATE SET` for upsert
 * and `SUPER` for JSON columns (Redshift's semi-structured type).
 * All DDL/DML is delegated to the injected `executor`.
 */
export class RedshiftConnector extends BaseConnector {
  override readonly type = 'redshift';

  readonly host: string;
  readonly database: string;
  readonly schema: string;

  constructor(config: RedshiftConfig) {
    super(config.executor);
    this.host = config.host;
    this.database = config.database;
    this.schema = config.schema;
  }

  protected override async upsertRow(
    table: string,
    row: WarehouseRecord,
    keyColumns: string[],
  ): Promise<void> {
    const sql = this.buildUpsertSql(table, row, keyColumns);
    await this.executor(sql, Object.values(row));
  }

  protected override mapColumnType(type: ColumnType): string {
    if (type === 'json') return 'SUPER';
    return super.mapColumnType(type);
  }
}
