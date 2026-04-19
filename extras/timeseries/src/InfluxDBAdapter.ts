import type {
  DataPoint,
  TimeRange,
  RetentionPolicy,
  RetentionResult,
  TimeSeriesAdapter,
  TSQueryExecutor,
} from './types.js';

/** Configuration for {@link InfluxDBAdapter}. */
export interface InfluxDBConfig {
  org: string;
  bucket: string;
  executor: TSQueryExecutor;
}

/**
 * Time series adapter for InfluxDB.
 *
 * Uses the InfluxDB **line protocol** for writes and a Flux-style query DSL
 * for reads. All I/O is delegated to the injected {@link TSQueryExecutor},
 * making the adapter fully testable without a real InfluxDB instance.
 */
export class InfluxDBAdapter implements TimeSeriesAdapter {
  readonly type = 'influxdb';

  private readonly org: string;
  private readonly bucket: string;
  private readonly executor: TSQueryExecutor;

  constructor(config: InfluxDBConfig) {
    this.org = config.org;
    this.bucket = config.bucket;
    this.executor = config.executor;
  }

  /**
   * Write data points using InfluxDB line protocol.
   * Each point is formatted as `measurement[,tags] fields timestamp`.
   */
  async write(points: readonly DataPoint[]): Promise<number> {
    if (points.length === 0) return 0;
    const lines = points.map((p) => this.toLineProtocol(p)).join('\n');
    await this.executor(`WRITE org=${this.org} bucket=${this.bucket}\n${lines}`);
    return points.length;
  }

  /**
   * Query data points via a Flux-style pipeline.
   * The executor is expected to return rows that can be mapped to {@link DataPoint}.
   */
  async query(
    measurement: string,
    range: TimeRange,
    tags?: Record<string, string>,
  ): Promise<DataPoint[]> {
    const flux = this.buildFluxQuery(measurement, range, tags);
    const rows = await this.executor(flux);
    return rows.map((row) => this.rowToDataPoint(row));
  }

  /** Drop all stored data for a measurement. */
  async deleteMeasurement(measurement: string): Promise<void> {
    await this.executor(`DELETE FROM bucket="${this.bucket}" WHERE _measurement="${measurement}"`);
  }

  /** Delete points older than `Date.now() - policy.durationMs`. */
  async applyRetentionPolicy(policy: RetentionPolicy): Promise<RetentionResult> {
    const threshold = Date.now() - policy.durationMs;
    const rows = await this.executor(
      `DELETE FROM bucket="${this.bucket}" WHERE _measurement="${policy.measurement}" AND time < ${threshold}`,
    );
    const deletedCount =
      rows.length > 0 ? ((rows[0]?.['deleted'] as number | undefined) ?? rows.length) : 0;
    return { policy, deletedCount };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private toLineProtocol(point: DataPoint): string {
    const tagStr = this.buildTagString(point.tags);
    const prefix = tagStr.length > 0 ? `${point.measurement},${tagStr}` : point.measurement;
    const fieldStr = Object.entries(point.fields)
      .map(([k, v]) => `${k}=${typeof v === 'string' ? `"${v}"` : String(v)}`)
      .join(',');
    return `${prefix} ${fieldStr} ${point.timestamp}`;
  }

  private buildTagString(tags?: Record<string, string>): string {
    if (tags === undefined) return '';
    return Object.entries(tags)
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
  }

  private buildFluxQuery(
    measurement: string,
    range: TimeRange,
    tags?: Record<string, string>,
  ): string {
    let q =
      `from(bucket:"${this.bucket}")` +
      ` |> range(start:${range.start},stop:${range.end})` +
      ` |> filter(fn:(r) => r._measurement == "${measurement}")`;
    if (tags !== undefined) {
      for (const [k, v] of Object.entries(tags)) {
        q += ` |> filter(fn:(r) => r.${k} == "${v}")`;
      }
    }
    return q;
  }

  private rowToDataPoint(row: Record<string, unknown>): DataPoint {
    const timestamp = (row['_time'] as number | undefined) ?? 0;
    const measurement = (row['_measurement'] as string | undefined) ?? '';
    const fields = this.extractFields(row);
    const tags = this.extractTags(row);

    const point: DataPoint = { timestamp, measurement, fields };
    if (Object.keys(tags).length > 0) {
      point.tags = tags;
    }
    return point;
  }

  private extractFields(row: Record<string, unknown>): Record<string, number | string | boolean> {
    const fields: Record<string, number | string | boolean> = {};
    for (const [k, v] of Object.entries(row)) {
      if (k === '_time' || k === '_measurement' || k.startsWith('tag_')) continue;
      if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
        fields[k] = v;
      }
    }
    return fields;
  }

  private extractTags(row: Record<string, unknown>): Record<string, string> {
    const tags: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      if (k.startsWith('tag_')) {
        tags[k.slice(4)] = String(v);
      }
    }
    return tags;
  }
}
