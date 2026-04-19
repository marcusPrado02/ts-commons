import type { QueryExecutor, WarehouseRecord, ColumnType } from '../types.js';
import { BaseConnector } from './BaseConnector.js';

/** Connection configuration for Snowflake. */
export interface SnowflakeConfig {
  readonly account: string;
  readonly warehouse: string;
  readonly database: string;
  readonly schema: string;
  readonly executor: QueryExecutor;
}

/**
 * Warehouse connector for **Snowflake**.
 *
 * Uses `MERGE INTO` for upsert and `VARIANT` for JSON columns.
 * All DDL/DML is delegated to the injected `executor` — no real
 * Snowflake SDK dependency is required, making the connector fully testable.
 */
export class SnowflakeConnector extends BaseConnector {
  override readonly type = 'snowflake';

  readonly account: string;
  readonly warehouse: string;
  readonly database: string;
  readonly schema: string;

  constructor(config: SnowflakeConfig) {
    super(config.executor);
    this.account = config.account;
    this.warehouse = config.warehouse;
    this.database = config.database;
    this.schema = config.schema;
  }

  protected override async upsertRow(
    table: string,
    row: WarehouseRecord,
    keyColumns: string[],
  ): Promise<void> {
    const sql = this.buildMergeSql(table, row, keyColumns);
    await this.executor(sql, Object.values(row));
  }

  protected override mapColumnType(type: ColumnType): string {
    if (type === 'json') return 'VARIANT';
    return super.mapColumnType(type);
  }
}
