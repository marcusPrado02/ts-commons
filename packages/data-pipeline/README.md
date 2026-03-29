# @marcusprado02/data-pipeline

ETL (Extract-Transform-Load) framework. Streams or batches records through composable transformers with built-in validation, Dead Letter Queue (DLQ), and reprocessing support.

## Installation

```bash
pnpm add @marcusprado02/data-pipeline
```

## Quick Start

```typescript
import {
  DataPipeline,
  ArraySource,
  InMemoryDestination,
  FunctionTransformer,
} from '@marcusprado02/data-pipeline';

const source = new ArraySource([
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
]);
const destination = new InMemoryDestination();
const upper = new FunctionTransformer((r) => ({ ...r, name: r.name.toUpperCase() }));

const pipeline = new DataPipeline(source, destination, {
  transformers: [upper],
  batchSize: 100,
});

const result = await pipeline.run();
// result.processedCount, result.failedCount, result.durationMs
```

## Streaming Mode

```typescript
import { StreamProcessor } from '@marcusprado02/data-pipeline';

const stream = new StreamProcessor(source, destination, transformers);
for await (const batch of stream.process()) {
  console.log(`Processed ${batch.length} records`);
}
```

## Dead Letter Queue

Records that fail transformation or validation are routed to a DLQ for later inspection:

```typescript
pipeline.onDlq((entry) => {
  // entry.record, entry.error, entry.retryCount
  logger.error('Failed record', entry);
});
```

## See Also

- [`@marcusprado02/data-quality`](../data-quality) — validation and profiling
- [`@marcusprado02/streams`](../streams) — stream primitives
- [`@marcusprado02/messaging`](../messaging) — event-based pipelines
