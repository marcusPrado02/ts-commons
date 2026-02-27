/**
 * Core types for the `@acme/timeseries` package.
 */

/** Epoch milliseconds */
export type Timestamp = number;

/** A single measurement data point written to a time series store. */
export interface DataPoint {
  /** Epoch ms when the point was recorded */
  timestamp: Timestamp;
  /** The measurement / series name */
  measurement: string;
  /** Optional key=value tags for indexing */
  tags?: Record<string, string>;
  /** Numeric, string or boolean field values */
  fields: Record<string, number | string | boolean>;
}

/** Inclusive time range expressed as epoch ms boundaries. */
export interface TimeRange {
  start: Timestamp;
  end: Timestamp;
}

/** Supported bucket granularities for {@link TimeBucketer}. */
export type BucketInterval = 'minute' | 'hour' | 'day' | 'week' | 'month';

/** A time bucket grouping data points that fall within the same interval. */
export interface TimeBucket {
  /** Start of the bucket (epoch ms, truncated to interval boundary) */
  timestamp: Timestamp;
  interval: BucketInterval;
  points: readonly DataPoint[];
}

/** Supported statistical aggregation functions. */
export type AggregateFunction = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'stddev';

/** Result produced by {@link AggregationEngine}. */
export interface AggregateResult {
  measurement: string;
  field: string;
  fn: AggregateFunction;
  value: number;
  range: TimeRange;
}

/** Downsampling algorithm. */
export type DownsampleAlgorithm = 'mean' | 'lttb';

/** Options for {@link Downsampler.downsample}. */
export interface DownsampleOptions {
  algorithm: DownsampleAlgorithm;
  /** Desired number of output points */
  targetPoints: number;
}

/** A named policy that governs how long data is kept for a measurement. */
export interface RetentionPolicy {
  name: string;
  measurement: string;
  /** Keep data newer than `Date.now() - durationMs` */
  durationMs: number;
}

/** Result of applying a single retention policy. */
export interface RetentionResult {
  policy: RetentionPolicy;
  deletedCount: number;
}

/** Generic query/write executor — implementations call the real DB client. */
export type TSQueryExecutor = (
  query: string,
  params?: unknown[],
) => Promise<Record<string, unknown>[]>;

/** Common contract implemented by {@link InfluxDBAdapter} and {@link TimescaleDBAdapter}. */
export interface TimeSeriesAdapter {
  readonly type: string;
  /** Write data points; returns the number of points written. */
  write(points: readonly DataPoint[]): Promise<number>;
  /** Query points for a measurement within a time range, with optional tag filters. */
  query(measurement: string, range: TimeRange, tags?: Record<string, string>): Promise<DataPoint[]>;
  /** Drop all data for a measurement. */
  deleteMeasurement(measurement: string): Promise<void>;
  /** Delete points that violate the policy's retention window. */
  applyRetentionPolicy(policy: RetentionPolicy): Promise<RetentionResult>;
}
