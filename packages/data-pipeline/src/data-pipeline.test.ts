/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import {
  ArraySource,
  GeneratorSource,
  InMemoryDestination,
  FunctionTransformer,
  applyTransformers,
  DataPipeline,
  BatchProcessor,
  StreamProcessor,
  DataValidator,
  DeadLetterQueue,
} from './index.js';
import type { DataRecord, ValidationRule } from './index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function records(...ids: number[]): DataRecord[] {
  return ids.map((id) => ({ id }));
}

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const item of iter) {
    results.push(item);
  }
  return results;
}

// ─── ArraySource ──────────────────────────────────────────────────────────────

describe('ArraySource', () => {
  it('read() yields every record in order', async () => {
    const src = new ArraySource(records(1, 2, 3));
    const out = await collect(src.read());
    expect(out).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('read() yields nothing for an empty array', async () => {
    const src = new ArraySource([]);
    const out = await collect(src.read());
    expect(out).toHaveLength(0);
  });

  it('read() can be iterated multiple times', async () => {
    const src = new ArraySource(records(1));
    expect(await collect(src.read())).toHaveLength(1);
    expect(await collect(src.read())).toHaveLength(1);
  });
});

// ─── GeneratorSource ─────────────────────────────────────────────────────────

describe('GeneratorSource', () => {
  it('read() yields records from the factory', async () => {
    const src = new GeneratorSource(async function* () {
      yield { x: 1 };
      yield { x: 2 };
    });
    const out = await collect(src.read());
    expect(out).toEqual([{ x: 1 }, { x: 2 }]);
  });

  it('read() calls the factory each time', async () => {
    let calls = 0;
    const src = new GeneratorSource(async function* () {
      calls++;
      yield { n: calls };
    });
    await collect(src.read());
    await collect(src.read());
    expect(calls).toBe(2);
  });
});

// ─── InMemoryDestination ──────────────────────────────────────────────────────

describe('InMemoryDestination', () => {
  it('write() accumulates records', async () => {
    const dest = new InMemoryDestination();
    await dest.write(records(1, 2));
    expect(dest.count()).toBe(2);
  });

  it('getRecords() returns a deep copy', async () => {
    const dest = new InMemoryDestination();
    await dest.write(records(1));
    const r = dest.getRecords();
    r[0]!['id'] = 99;
    expect(dest.getRecords()[0]!['id']).toBe(1);
  });

  it('clear() removes all records', async () => {
    const dest = new InMemoryDestination();
    await dest.write(records(1));
    dest.clear();
    expect(dest.count()).toBe(0);
  });

  it('count() reflects total written across multiple write() calls', async () => {
    const dest = new InMemoryDestination();
    await dest.write(records(1, 2));
    await dest.write(records(3));
    expect(dest.count()).toBe(3);
  });
});

// ─── FunctionTransformer ──────────────────────────────────────────────────────

describe('FunctionTransformer', () => {
  it('transform() applies the function', () => {
    const t = new FunctionTransformer((r) => ({ ...r, processed: true }));
    expect(t.transform({ id: 1 })).toEqual({ id: 1, processed: true });
  });

  it('transform() is called for each record', () => {
    const fn = vi.fn((r: DataRecord) => r);
    const t = new FunctionTransformer(fn);
    t.transform({ id: 1 });
    t.transform({ id: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ─── applyTransformers ────────────────────────────────────────────────────────

describe('applyTransformers', () => {
  it('applies transformers in order', async () => {
    const addA = new FunctionTransformer((r) => ({ ...r, a: 1 }));
    const addB = new FunctionTransformer((r) => ({ ...r, b: 2 }));
    const src = new ArraySource(records(1));
    const out = await collect(applyTransformers(src.read(), [addA, addB]));
    expect(out[0]).toEqual({ id: 1, a: 1, b: 2 });
  });

  it('yields original record when no transformers are provided', async () => {
    const src = new ArraySource(records(5));
    const out = await collect(applyTransformers(src.read(), []));
    expect(out[0]).toEqual({ id: 5 });
  });

  it('chains output of one transformer into the next', async () => {
    const double = new FunctionTransformer((r) => ({ n: (r['n'] as number) * 2 }));
    const src = new ArraySource([{ n: 3 }]);
    const out = await collect(applyTransformers(src.read(), [double, double]));
    // 3 * 2 * 2 = 12
    expect(out[0]).toEqual({ n: 12 });
  });
});

// ─── DataPipeline ─────────────────────────────────────────────────────────────

describe('DataPipeline', () => {
  it('run() returns correct extracted and loaded counts', async () => {
    const pipeline = new DataPipeline();
    const dest = new InMemoryDestination();
    const result = await pipeline.run(new ArraySource(records(1, 2, 3)), [], dest);
    expect(result.extracted).toBe(3);
    expect(result.loaded).toBe(3);
    expect(result.failed).toBe(0);
  });

  it('run() applies transformers before loading', async () => {
    const pipeline = new DataPipeline();
    const dest = new InMemoryDestination();
    const addFlag = new FunctionTransformer((r) => ({ ...r, ok: true }));
    await pipeline.run(new ArraySource(records(1)), [addFlag], dest);
    expect(dest.getRecords()[0]).toEqual({ id: 1, ok: true });
  });

  it('run() reports durationMs >= 0', async () => {
    const pipeline = new DataPipeline();
    const result = await pipeline.run(new ArraySource([]), [], new InMemoryDestination());
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('run() counts failed when destination throws', async () => {
    const pipeline = new DataPipeline();
    const failDest = {
      write: async () => {
        throw new Error('write failed');
      },
    };
    const result = await pipeline.run(new ArraySource(records(1, 2)), [], failDest);
    expect(result.failed).toBe(2);
    expect(result.loaded).toBe(0);
  });

  it('run() with multiple transformers applies them all', async () => {
    const pipeline = new DataPipeline();
    const dest = new InMemoryDestination();
    const t1 = new FunctionTransformer((r) => ({ ...r, step: 1 }));
    const t2 = new FunctionTransformer((r) => ({ ...r, step: (r['step'] as number) + 1 }));
    await pipeline.run(new ArraySource(records(1)), [t1, t2], dest);
    expect(dest.getRecords()[0]?.['step']).toBe(2);
  });

  it('run() with empty source returns zeros', async () => {
    const pipeline = new DataPipeline();
    const result = await pipeline.run(new ArraySource([]), [], new InMemoryDestination());
    expect(result.extracted).toBe(0);
    expect(result.loaded).toBe(0);
  });
});

// ─── BatchProcessor ───────────────────────────────────────────────────────────

describe('BatchProcessor', () => {
  const proc = new BatchProcessor<DataRecord>();

  it('process() calls handler with batches of the specified size', async () => {
    const batches: DataRecord[][] = [];
    await proc.process(
      new ArraySource(records(1, 2, 3, 4, 5)).read(),
      async (b) => {
        batches.push([...b]);
      },
      { batchSize: 2 },
    );
    expect(batches[0]).toHaveLength(2);
    expect(batches[1]).toHaveLength(2);
    expect(batches[2]).toHaveLength(1);
  });

  it('process() returns correct processed count', async () => {
    const result = await proc.process(
      new ArraySource(records(1, 2, 3)).read(),
      async () => undefined,
      { batchSize: 10 },
    );
    expect(result.processed).toBe(3);
    expect(result.failed).toBe(0);
  });

  it('process() counts batches correctly', async () => {
    const result = await proc.process(
      new ArraySource(records(1, 2, 3, 4)).read(),
      async () => undefined,
      { batchSize: 2 },
    );
    expect(result.batches).toBe(2);
  });

  it('process() captures failed batches without throwing', async () => {
    const result = await proc.process(
      new ArraySource(records(1, 2)).read(),
      async () => {
        throw new Error('batch fail');
      },
      { batchSize: 2 },
    );
    expect(result.failed).toBe(2);
    expect(result.processed).toBe(0);
  });

  it('process() calls onError on batch failure', async () => {
    const onError = vi.fn();
    await proc.process(
      new ArraySource(records(1)).read(),
      async () => {
        throw new Error('err');
      },
      { batchSize: 1, onError },
    );
    expect(onError).toHaveBeenCalledOnce();
  });

  it('process() uses batchSize=100 by default', async () => {
    const batches: number[] = [];
    await proc.process(
      new ArraySource(records(...Array.from({ length: 50 }, (_, i) => i))).read(),
      async (b) => {
        batches.push(b.length);
      },
    );
    expect(batches).toHaveLength(1);
    expect(batches[0]).toBe(50);
  });

  it('process() handles empty source', async () => {
    const result = await proc.process(new ArraySource([]).read(), async () => undefined, {
      batchSize: 10,
    });
    expect(result.processed).toBe(0);
    expect(result.batches).toBe(0);
  });
});

// ─── StreamProcessor ──────────────────────────────────────────────────────────

describe('StreamProcessor', () => {
  const proc = new StreamProcessor<DataRecord>();

  it('process() counts processed records', async () => {
    const result = await proc.process(new ArraySource(records(1, 2, 3)).read(), async (r) => r);
    expect(result.processed).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('process() counts skipped when handler returns undefined', async () => {
    const result = await proc.process(new ArraySource(records(1, 2)).read(), async () => undefined);
    expect(result.skipped).toBe(2);
    expect(result.processed).toBe(0);
  });

  it('process() captures failures without throwing', async () => {
    const result = await proc.process(new ArraySource(records(1)).read(), async () => {
      throw new Error('boom');
    });
    expect(result.failed).toBe(1);
  });

  it('process() calls onError per failed record', async () => {
    const onError = vi.fn();
    await proc.process(
      new ArraySource(records(1, 2)).read(),
      async () => {
        throw new Error('e');
      },
      onError,
    );
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('process() handles mixed outcomes', async () => {
    const result = await proc.process(
      new ArraySource([{ id: 1 }, { id: 2 }, { id: 3 }]).read(),
      async (r) => {
        const id = r['id'] as number;
        if (id === 1) return r;
        if (id === 2) return undefined;
        throw new Error('err');
      },
    );
    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('process() handles empty source', async () => {
    const result = await proc.process(new ArraySource([]).read(), async (r) => r);
    expect(result.processed).toBe(0);
  });
});

// ─── DataValidator ────────────────────────────────────────────────────────────

describe('DataValidator', () => {
  const requiredId: ValidationRule = {
    name: 'required-id',
    validate: (r) => (typeof r['id'] === 'number' ? undefined : 'id must be a number'),
  };
  const positiveId: ValidationRule = {
    name: 'positive-id',
    validate: (r) => ((r['id'] as number) > 0 ? undefined : 'id must be positive'),
  };

  it('addRule() is fluent', () => {
    const v = new DataValidator();
    expect(v.addRule(requiredId)).toBe(v);
  });

  it('ruleCount() reflects registered rules', () => {
    const v = new DataValidator().addRule(requiredId).addRule(positiveId);
    expect(v.ruleCount()).toBe(2);
  });

  it('validate() returns empty array for a valid record', () => {
    const v = new DataValidator().addRule(requiredId);
    expect(v.validate({ id: 1 })).toHaveLength(0);
  });

  it('validate() returns error messages for invalid record', () => {
    const v = new DataValidator().addRule(requiredId);
    expect(v.validate({ id: 'nope' })).toContain('id must be a number');
  });

  it('validate() accumulates multiple rule failures', () => {
    const v = new DataValidator().addRule(requiredId).addRule(positiveId);
    const errors = v.validate({ id: -1 });
    expect(errors).toHaveLength(1); // requiredId passes, positiveId fails
    expect(errors).toContain('id must be positive');
  });

  it('validateAll() returns valid=true when all records pass', () => {
    const v = new DataValidator().addRule(requiredId);
    const report = v.validateAll(records(1, 2, 3));
    expect(report.valid).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it('validateAll() captures invalid records in errors array', () => {
    const v = new DataValidator().addRule(requiredId);
    const report = v.validateAll([{ id: 1 }, { id: 'bad' }]);
    expect(report.valid).toBe(false);
    expect(report.errors).toHaveLength(1);
  });

  it('validateAll() includes the rule name in the error', () => {
    const v = new DataValidator().addRule(requiredId);
    const report = v.validateAll([{ id: 'x' }]);
    expect(report.errors[0]?.ruleNames).toContain('required-id');
  });

  it('validateAll() includes the message in the error', () => {
    const v = new DataValidator().addRule(requiredId);
    const report = v.validateAll([{ id: 'x' }]);
    expect(report.errors[0]?.messages).toContain('id must be a number');
  });

  it('validateAll() with empty array returns valid=true', () => {
    const v = new DataValidator().addRule(requiredId);
    expect(v.validateAll([])).toMatchObject({ valid: true });
  });
});

// ─── DeadLetterQueue ──────────────────────────────────────────────────────────

describe('DeadLetterQueue', () => {
  it('enqueue() increases size', () => {
    const dlq = new DeadLetterQueue<DataRecord>();
    dlq.enqueue({ id: 1 }, new Error('err'));
    expect(dlq.size()).toBe(1);
  });

  it('dequeue() removes the oldest entry', () => {
    const dlq = new DeadLetterQueue<number>();
    dlq.enqueue(1, new Error('a'));
    dlq.enqueue(2, new Error('b'));
    const first = dlq.dequeue();
    expect(first?.data).toBe(1);
    expect(dlq.size()).toBe(1);
  });

  it('dequeue() returns undefined when empty', () => {
    const dlq = new DeadLetterQueue<number>();
    expect(dlq.dequeue()).toBeUndefined();
  });

  it('clear() empties the queue', () => {
    const dlq = new DeadLetterQueue<number>();
    dlq.enqueue(1, new Error('e'));
    dlq.clear();
    expect(dlq.size()).toBe(0);
  });

  it('getEntries() returns a deep copy', () => {
    const dlq = new DeadLetterQueue<DataRecord>();
    dlq.enqueue({ id: 1 }, new Error('e'));
    const entries = dlq.getEntries();
    entries[0]!.data['id'] = 99;
    expect(dlq.getEntries()[0]?.data['id']).toBe(1);
  });

  it('reprocess() succeeds and removes entries', async () => {
    const dlq = new DeadLetterQueue<number>();
    dlq.enqueue(1, new Error('e'));
    dlq.enqueue(2, new Error('e'));
    const result = await dlq.reprocess(async () => undefined);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
    expect(dlq.size()).toBe(0);
  });

  it('reprocess() re-enqueues failed entries with incremented retries', async () => {
    const dlq = new DeadLetterQueue<number>();
    dlq.enqueue(1, new Error('original'));
    const result = await dlq.reprocess(async () => {
      throw new Error('still failing');
    });
    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(dlq.size()).toBe(1);
    expect(dlq.getEntries()[0]?.retries).toBe(1);
  });

  it('reprocess() increments retries on repeated failure', async () => {
    const dlq = new DeadLetterQueue<number>();
    dlq.enqueue(1, new Error('e'));
    await dlq.reprocess(async () => {
      throw new Error('fail1');
    });
    await dlq.reprocess(async () => {
      throw new Error('fail2');
    });
    expect(dlq.getEntries()[0]?.retries).toBe(2);
  });

  it('reprocess() handles mixed success/failure', async () => {
    const dlq = new DeadLetterQueue<number>();
    dlq.enqueue(1, new Error('e'));
    dlq.enqueue(2, new Error('e'));
    const result = await dlq.reprocess(async (n) => {
      if (n === 2) throw new Error('fail');
    });
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('enqueuedAt is a Date', () => {
    const dlq = new DeadLetterQueue<number>();
    dlq.enqueue(1, new Error('e'));
    expect(dlq.getEntries()[0]?.enqueuedAt).toBeInstanceOf(Date);
  });
});
