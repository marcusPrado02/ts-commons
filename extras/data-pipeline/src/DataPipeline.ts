import type { DataSource, DataDestination, Transformer, PipelineResult } from './types.js';
import { applyTransformers } from './Transformer.js';

/**
 * Orchestrates a complete Extract-Transform-Load pipeline.
 *
 * @example
 * const result = await new DataPipeline().run(source, [myTransformer], destination);
 */
export class DataPipeline {
  /**
   * Run the full ETL flow:
   * 1. Extract records from `source`.
   * 2. Apply each `transformer` in sequence to every record.
   * 3. Load all transformed records into `destination`.
   *
   * @returns A {@link PipelineResult} with counts and elapsed time.
   */
  async run(
    source: DataSource,
    transformers: readonly Transformer[],
    destination: DataDestination,
  ): Promise<PipelineResult> {
    const start = Date.now();
    let extracted = 0;
    let transformed = 0;
    let failed = 0;

    const raw = source.read();
    const transformedStream = applyTransformers(raw, transformers);

    const records = [];
    for await (const record of transformedStream) {
      extracted++;
      transformed++;
      records.push(record);
    }

    try {
      await destination.write(records);
    } catch {
      failed = records.length;
    }

    return {
      extracted,
      transformed,
      loaded: records.length - failed,
      failed,
      durationMs: Date.now() - start,
    };
  }
}
