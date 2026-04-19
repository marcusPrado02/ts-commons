import type {
  WarehouseConnector,
  TableSchema,
  SchemaChange,
  SchemaEvolutionResult,
} from './types.js';

type ChangeRecord = { change: SchemaChange; success: boolean; error?: string };

/**
 * Manages schema evolution for warehouse tables.
 *
 * - {@link generateDiff} computes the set of {@link SchemaChange}s needed to
 *   transform `currentSchema` into `targetSchema`.
 * - {@link apply} executes a list of changes against a live connector, capturing
 *   per-change success / failure without aborting on partial errors.
 */
export class SchemaEvolutionManager {
  /**
   * Compute the diff between two schema versions.
   *
   * Detects: added columns, dropped columns, and altered column types.
   * Renamed columns are **not** auto-detected (use explicit {@link SchemaChange}s for that).
   */
  generateDiff(current: TableSchema, target: TableSchema): SchemaChange[] {
    const currentCols = new Map(current.columns.map((c) => [c.name, c]));
    const targetCols = new Map(target.columns.map((c) => [c.name, c]));
    const changes: SchemaChange[] = [];

    for (const [name, col] of targetCols) {
      if (!currentCols.has(name)) {
        changes.push({
          type: 'add_column',
          tableName: target.tableName,
          columnName: name,
          newColumn: col,
        });
      }
    }

    for (const [name] of currentCols) {
      if (!targetCols.has(name)) {
        changes.push({ type: 'drop_column', tableName: current.tableName, columnName: name });
      }
    }

    for (const [name, currentCol] of currentCols) {
      const targetCol = targetCols.get(name);
      if (targetCol !== undefined && targetCol.type !== currentCol.type) {
        changes.push({
          type: 'alter_column',
          tableName: target.tableName,
          columnName: name,
          newColumn: targetCol,
        });
      }
    }

    return changes;
  }

  /**
   * Apply a list of schema changes via the connector.
   *
   * Errors are captured per-change; processing continues after failures.
   */
  async apply(
    connector: WarehouseConnector,
    changes: readonly SchemaChange[],
  ): Promise<SchemaEvolutionResult> {
    const results: ChangeRecord[] = [];
    let applied = 0;

    for (const change of changes) {
      const record = await this.applyOne(connector, change);
      results.push(record);
      if (record.success) applied++;
    }

    return { applied, failed: changes.length - applied, changes: results };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async applyOne(
    connector: WarehouseConnector,
    change: SchemaChange,
  ): Promise<ChangeRecord> {
    try {
      await connector.query(this.buildAlterSql(change));
      return { change, success: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { change, success: false, error };
    }
  }

  private buildAlterSql(change: SchemaChange): string {
    if (change.type === 'add_column' && change.newColumn !== undefined) {
      const nullable = change.newColumn.nullable ? '' : ' NOT NULL';
      return `ALTER TABLE ${change.tableName} ADD COLUMN ${change.columnName} ${change.newColumn.type.toUpperCase()}${nullable}`;
    }
    if (change.type === 'drop_column') {
      return `ALTER TABLE ${change.tableName} DROP COLUMN ${change.columnName}`;
    }
    if (change.type === 'rename_column' && change.newName !== undefined) {
      return `ALTER TABLE ${change.tableName} RENAME COLUMN ${change.columnName} TO ${change.newName}`;
    }
    if (change.type === 'alter_column' && change.newColumn !== undefined) {
      return `ALTER TABLE ${change.tableName} ALTER COLUMN ${change.columnName} TYPE ${change.newColumn.type.toUpperCase()}`;
    }
    return `-- no-op: ${change.type} on ${change.tableName}.${change.columnName}`;
  }
}
