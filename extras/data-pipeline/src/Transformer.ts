import type { Transformer, DataRecord } from './types.js';

/**
 * Wraps a plain function as a {@link Transformer}.
 */
export class FunctionTransformer implements Transformer {
  constructor(private readonly fn: (record: DataRecord) => DataRecord) {}

  transform(record: DataRecord): DataRecord {
    return this.fn(record);
  }
}

/**
 * Applies a list of {@link Transformer}s in order to each record from an
 * async iterable, yielding the result one by one.
 */
export async function* applyTransformers(
  source: AsyncIterable<DataRecord>,
  transformers: readonly Transformer[],
): AsyncGenerator<DataRecord> {
  for await (const record of source) {
    let current = record;
    for (const t of transformers) {
      current = t.transform(current);
    }
    yield current;
  }
}
