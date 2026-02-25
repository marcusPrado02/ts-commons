import type { DataSource, DataRecord } from './types.js';

/**
 * In-memory {@link DataSource} backed by a plain array.
 *
 * Useful in tests and for small, pre-loaded data sets.
 */
export class ArraySource implements DataSource {
  constructor(private readonly records: readonly DataRecord[]) {}

  async *read(): AsyncGenerator<DataRecord> {
    await Promise.resolve(); // ensure the method is genuinely async
    for (const record of this.records) {
      yield record;
    }
  }
}

/**
 * In-memory {@link DataSource} backed by an async generator factory.
 *
 * Gives full control over the async record stream.
 */
export class GeneratorSource implements DataSource {
  constructor(private readonly factory: () => AsyncGenerator<DataRecord>) {}

  read(): AsyncIterable<DataRecord> {
    return this.factory();
  }
}
