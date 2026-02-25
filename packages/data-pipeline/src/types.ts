/**
 * Core types for the @acme/data-pipeline package.
 */

/** The fundamental unit of data flowing through a pipeline. */
export type DataRecord = Record<string, unknown>;

/** Reads records from a data source as an async iterable. */
export interface DataSource {
  read(): AsyncIterable<DataRecord>;
}

/** Writes a batch of records to a destination. */
export interface DataDestination {
  write(records: readonly DataRecord[]): Promise<void>;
}

/** Synchronously transforms one record into another. */
export interface Transformer {
  transform(record: DataRecord): DataRecord;
}

/** A named rule that validates a single record. Returns an error message or undefined. */
export interface ValidationRule {
  readonly name: string;
  validate(record: DataRecord): string | undefined;
}

/**
 * Summary returned after a full ETL pipeline run.
 */
export interface PipelineResult {
  readonly extracted: number;
  readonly transformed: number;
  readonly loaded: number;
  readonly failed: number;
  readonly durationMs: number;
}

/** Options for batch processing. */
export interface BatchOptions<T = DataRecord> {
  readonly batchSize: number;
  readonly onError?: (error: Error, batch: readonly T[]) => void;
}

/** Statistics returned by a batch processing run. */
export interface BatchResult {
  readonly processed: number;
  readonly batches: number;
  readonly failed: number;
}

/** Statistics returned by a stream processing run. */
export interface StreamResult {
  readonly processed: number;
  readonly skipped: number;
  readonly failed: number;
}

/** A single entry held in a Dead Letter Queue. */
export interface DlqEntry<T> {
  readonly data: T;
  readonly error: Error;
  readonly enqueuedAt: Date;
  readonly retries: number;
}

/** Statistics returned after reprocessing DLQ entries. */
export interface ReprocessResult {
  readonly succeeded: number;
  readonly failed: number;
}

/** A per-record validation failure entry. */
export interface ValidationError {
  readonly record: DataRecord;
  readonly ruleNames: readonly string[];
  readonly messages: readonly string[];
}

/** The aggregated result of validating many records. */
export interface ValidationReport {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
}
