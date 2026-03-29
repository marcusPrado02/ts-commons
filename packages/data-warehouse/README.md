# @marcusprado02/data-warehouse

Cloud data warehouse connectors for Snowflake, BigQuery, and Amazon Redshift. Provides a unified `WarehouseConnector` interface for query execution, data sync, and schema evolution.

## Installation

```bash
pnpm add @marcusprado02/data-warehouse
```

## Quick Start

```typescript
import { SnowflakeConnector, DataSyncManager } from '@marcusprado02/data-warehouse';
import type { SnowflakeConfig } from '@marcusprado02/data-warehouse';

const config: SnowflakeConfig = {
  account: 'myorg.snowflakecomputing.com',
  database: 'ANALYTICS',
  schema: 'PUBLIC',
  warehouse: 'COMPUTE_WH',
};

const connector = new SnowflakeConnector(config);
await connector.connect();

const results = await connector.query('SELECT * FROM orders WHERE created_at > CURRENT_DATE - 7');
```

## Connectors

| Connector       | Class                |
| --------------- | -------------------- |
| Snowflake       | `SnowflakeConnector` |
| BigQuery        | `BigQueryConnector`  |
| Amazon Redshift | `RedshiftConnector`  |

## Data Sync

```typescript
import { DataSyncManager } from '@marcusprado02/data-warehouse';

const sync = new DataSyncManager(connector);
const result = await sync.sync(sourceRecords, 'orders_staging', {
  mode: 'UPSERT',
  keyFields: ['order_id'],
});
```

## Schema Evolution

```typescript
import { SchemaEvolutionManager } from '@marcusprado02/data-warehouse';

const evolution = new SchemaEvolutionManager(connector);
const changes = await evolution.diff(currentSchema, newSchema);
await evolution.apply(changes, { dryRun: false });
```

## See Also

- [`@marcusprado02/data-pipeline`](../data-pipeline) — ETL framework
- [`@marcusprado02/data-quality`](../data-quality) — validation and profiling
