# @marcusprado02/cdc

Change Data Capture (CDC) — normalizes and processes database change events from Debezium, PostgreSQL logical replication, MySQL binlog, and MongoDB changestreams into a unified `CdcEvent` format.

## Installation

```bash
pnpm add @marcusprado02/cdc
```

## Quick Start

```typescript
import { EventNormalizer, CdcFilter, CdcProcessor } from '@marcusprado02/cdc';

const normalizer = new EventNormalizer();
const filter = new CdcFilter({ operations: ['INSERT', 'UPDATE'], tables: ['orders'] });
const processor = new CdcProcessor({ normalizer, filter });

// Process a raw Debezium event
const event = await processor.process(rawDebeziumEvent);
// event.operation === 'INSERT', event.table === 'orders', event.after === {...}
```

## Supported Sources

| Source             | Raw type      |
| ------------------ | ------------- |
| Debezium (generic) | `DebeziumRaw` |
| PostgreSQL         | `PgRaw`       |
| MySQL              | `MySqlRaw`    |
| MongoDB            | `MongoRaw`    |

## API

| Export            | Description                                             |
| ----------------- | ------------------------------------------------------- |
| `EventNormalizer` | Converts raw CDC events to a unified `CdcEvent`         |
| `CdcFilter`       | Filters events by table, operation, or custom predicate |
| `CdcTransformer`  | Applies field mappings and enrichment                   |
| `CdcProcessor`    | Orchestrates normalizer → filter → transformer pipeline |

## See Also

- [`@marcusprado02/messaging`](../messaging) — event publishing
- [`@marcusprado02/eventsourcing`](../eventsourcing) — event sourcing patterns
