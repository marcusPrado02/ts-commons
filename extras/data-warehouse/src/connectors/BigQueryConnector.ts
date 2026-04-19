import type { QueryExecutor, WarehouseRecord, ColumnType } from '../types.js';
import { BaseConnector } from './BaseConnector.js';

/** Connection configuration for BigQuery. */
export interface BigQueryConfig {
  readonly projectId: string;
  readonly dataset: string;
  readonly executor: QueryExecutor;
}

/**
 * Warehouse connector for **Google BigQuery**.
 *
 * Uses `MERGE` for upsert and BigQuery-native column types
 * (`STRING`, `FLOAT64`, `BOOL`, `TIMESTAMP`, `JSON`).
 * All DDL/DML is delegated to the injected `executor`.
 */
export class BigQueryConnector extends BaseConnector {
  override readonly type = 'bigquery';

  readonly projectId: string;
  readonly dataset: string;

  constructor(config: BigQueryConfig) {
    super(config.executor);
    this.projectId = config.projectId;
    this.dataset = config.dataset;
  }

  /** Qualify a table name with `project.dataset.table`. */
  qualifyTable(table: string): string {
    return `${this.projectId}.${this.dataset}.${table}`;
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
    const map: Record<ColumnType, string> = {
      string: 'STRING',
      number: 'FLOAT64',
      boolean: 'BOOL',
      date: 'TIMESTAMP',
      json: 'JSON',
    };
    return map[type];
  }
}
