import type { WarehouseConnector, WarehouseRecord, SyncOptions, SyncResult } from './types.js';

type SyncCounts = Readonly<{ inserted: number; updated: number; deleted: number; failed: number }>;

/**
 * Orchestrates data synchronisation between a source dataset and a target
 * warehouse table using configurable {@link SyncOptions.mode} strategies:
 *
 * - **full_refresh** — truncates the target and reloads all source rows
 * - **incremental** — appends only rows newer than the configured cursor value
 * - **merge** — upserts rows using the configured key column
 */
export class DataSyncManager {
  /**
   * Sync `sourceRows` into `targetTable` on the given `connector`.
   *
   * @returns A {@link SyncResult} with row-level counters and elapsed time.
   */
  async sync(
    connector: WarehouseConnector,
    sourceRows: readonly WarehouseRecord[],
    targetTable: string,
    options: SyncOptions,
  ): Promise<SyncResult> {
    const start = Date.now();
    const counts = await this.runSync(connector, sourceRows, targetTable, options);
    return { ...counts, durationMs: Date.now() - start };
  }

  // ── Private dispatch ───────────────────────────────────────────────────────

  private async runSync(
    connector: WarehouseConnector,
    rows: readonly WarehouseRecord[],
    table: string,
    options: SyncOptions,
  ): Promise<SyncCounts> {
    if (options.mode === 'full_refresh')
      return this.runFullRefresh(connector, rows, table, options);
    if (options.mode === 'incremental') return this.runIncremental(connector, rows, table, options);
    return this.runMerge(connector, rows, table, options);
  }

  // ── Strategy implementations ───────────────────────────────────────────────

  private async runFullRefresh(
    connector: WarehouseConnector,
    rows: readonly WarehouseRecord[],
    table: string,
    options: SyncOptions,
  ): Promise<SyncCounts> {
    const deleted = await connector.delete(table, '1=1');
    const batchSize = options.batchSize ?? 1000;
    const inserted = await this.insertBatches(connector, table, rows, batchSize);
    return { inserted, updated: 0, deleted, failed: 0 };
  }

  private async runIncremental(
    connector: WarehouseConnector,
    rows: readonly WarehouseRecord[],
    table: string,
    options: SyncOptions,
  ): Promise<SyncCounts> {
    const filtered = this.filterByCursor(rows, options);
    const batchSize = options.batchSize ?? 1000;
    const inserted = await this.insertBatches(connector, table, filtered, batchSize);
    return { inserted, updated: 0, deleted: 0, failed: 0 };
  }

  private async runMerge(
    connector: WarehouseConnector,
    rows: readonly WarehouseRecord[],
    table: string,
    options: SyncOptions,
  ): Promise<SyncCounts> {
    const keyColumns = options.keyColumn !== undefined ? [options.keyColumn] : [];
    const batchSize = options.batchSize ?? 1000;
    let updated = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      updated += await connector.upsert(table, rows.slice(i, i + batchSize), keyColumns);
    }
    return { inserted: 0, updated, deleted: 0, failed: 0 };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private filterByCursor(
    rows: readonly WarehouseRecord[],
    options: SyncOptions,
  ): readonly WarehouseRecord[] {
    const { cursor, keyColumn } = options;
    if (cursor !== undefined && keyColumn !== undefined) {
      return rows.filter((row) => {
        const val = row[keyColumn];
        return val !== undefined && val !== null && cursor !== null && val > cursor;
      });
    }
    return rows;
  }

  private async insertBatches(
    connector: WarehouseConnector,
    table: string,
    rows: readonly WarehouseRecord[],
    batchSize: number,
  ): Promise<number> {
    let inserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      inserted += await connector.insert(table, rows.slice(i, i + batchSize));
    }
    return inserted;
  }
}
