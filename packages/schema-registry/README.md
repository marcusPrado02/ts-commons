# @acme/schema-registry

Schema registry port and adapters for event schema management. Registers, versions, and validates schemas with compatibility checks (BACKWARD, FORWARD, FULL). Adapters for Confluent Schema Registry and AWS Glue.

## Installation

```bash
pnpm add @acme/schema-registry
```

## Quick Start

```typescript
import { SchemaRegistry } from '@acme/schema-registry';
import type { Schema } from '@acme/schema-registry';

const registry = new SchemaRegistry(confluentAdapter);

// Register a schema
const schema: Schema = {
  subject: 'order-created',
  type: 'AVRO',
  definition: JSON.stringify({ type: 'record', name: 'OrderCreated', fields: [...] }),
};

const registered = await registry.register(schema);
// registered.id, registered.version

// Validate compatibility before publishing a new version
const compatible = await registry.checkCompatibility('order-created', newSchema);
```

## Adapters

| Backend                   | Adapter                     |
| ------------------------- | --------------------------- |
| Confluent Schema Registry | `ConfluentAdapter`          |
| AWS Glue Schema Registry  | `GlueAdapter`               |
| In-memory (testing)       | Built into `SchemaRegistry` |

## Compatibility Modes

`CompatibilityMode`: `'BACKWARD'` | `'FORWARD'` | `'FULL'` | `'NONE'`

```typescript
await registry.setCompatibility('order-created', 'BACKWARD');
```

## See Also

- [`@acme/messaging-kafka`](../messaging-kafka) — Kafka with schema validation
- [`@acme/eventsourcing`](../eventsourcing) — event sourcing with typed events
