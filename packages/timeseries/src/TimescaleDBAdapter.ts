import type {
  DataPoint,
  TimeRange,
  RetentionPolicy,
  RetentionResult,
  TimeSeriesAdapter,
  TSQueryExecutor,
} from './types.js';

/** Configuration for {@link TimescaleDBAdapter}. */
export interface TimescaleDBConfig {
  schema: string;
  executor: TSQueryExecutor;
}

/**
 * Time series adapter for TimescaleDB (PostgreSQL hypertables).
 *
 * Each measurement is stored in its own hypertable with columns
 * `(time BIGINT, tags JSONB, fields JSONB)`.
 * All I/O is handled by the injected {@link TSQueryExecutor}.
 */
export class TimescaleDBAdapter implements TimeSeriesAdapter {
  readonly type = 'timescaledb';

  private readonly schema: string;
  private readonly executor: TSQueryExecutor;

  constructor(config: TimescaleDBConfig) {
    this.schema = config.schema;
    this.executor = config.executor;
  }

  /**
   * Write data points via parameterised `INSERT` statements.
   * Returns the number of points written.
   */
  async write(points: readonly DataPoint[]): Promise<number> {
    if (points.length === 0) return 0;
    for (const p of points) {
      const table = this.qualifyTable(p.measurement);
      const tagsJson = JSON.stringify(p.tags ?? {});
      const fieldsJson = JSON.stringify(p.fields);
      await this.executor(`INSERT INTO ${table} (time, tags, fields) VALUES ($1, $2, $3)`, [
        p.timestamp,
        tagsJson,
        fieldsJson,
      ]);
    }
    return points.length;
  }

  /**
   * Query data points for a measurement within a time range.
   * Optional `tags` are applied as JSONB equality filters.
   */
  async query(
    measurement: string,
    range: TimeRange,
    tags?: Record<string, string>,
  ): Promise<DataPoint[]> {
    const table = this.qualifyTable(measurement);
    const { sql, params } = this.buildSelectSql(table, range, tags);
    const rows = await this.executor(sql, params);
    return rows.map((row) => this.rowToDataPoint(row, measurement));
  }

  /** Drop the hypertable for a measurement. */
  async deleteMeasurement(measurement: string): Promise<void> {
    const table = this.qualifyTable(measurement);
    await this.executor(`DROP TABLE IF EXISTS ${table}`);
  }

  /** Delete rows older than `Date.now() - policy.durationMs`. */
  async applyRetentionPolicy(policy: RetentionPolicy): Promise<RetentionResult> {
    const table = this.qualifyTable(policy.measurement);
    const threshold = Date.now() - policy.durationMs;
    const rows = await this.executor(`DELETE FROM ${table} WHERE time < $1 RETURNING *`, [
      threshold,
    ]);
    return { policy, deletedCount: rows.length };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  qualifyTable(measurement: string): string {
    return `${this.schema}.${measurement}`;
  }

  private buildSelectSql(
    table: string,
    range: TimeRange,
    tags?: Record<string, string>,
  ): { sql: string; params: unknown[] } {
    const params: unknown[] = [range.start, range.end];
    let sql = `SELECT time, tags, fields FROM ${table} WHERE time >= $1 AND time <= $2`;

    if (tags !== undefined) {
      let idx = 3;
      for (const [k, v] of Object.entries(tags)) {
        sql += ` AND tags->>'${k}' = $${idx}`;
        params.push(v);
        idx++;
      }
    }
    sql += ' ORDER BY time ASC';
    return { sql, params };
  }

  private rowToDataPoint(row: Record<string, unknown>, measurement: string): DataPoint {
    const timestamp = (row['time'] as number | undefined) ?? 0;
    const rawTags = row['tags'];
    const rawFields = row['fields'];

    const tags =
      typeof rawTags === 'string'
        ? (JSON.parse(rawTags) as Record<string, string>)
        : rawTags !== null && typeof rawTags === 'object'
          ? (rawTags as Record<string, string>)
          : undefined;

    const fields =
      typeof rawFields === 'string'
        ? (JSON.parse(rawFields) as Record<string, number | string | boolean>)
        : rawFields !== null && typeof rawFields === 'object'
          ? (rawFields as Record<string, number | string | boolean>)
          : {};

    const point: DataPoint = { timestamp, measurement, fields };
    if (tags !== undefined && Object.keys(tags).length > 0) {
      point.tags = tags;
    }
    return point;
  }
}
