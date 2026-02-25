// Types
export type {
  WarehouseRecord,
  ColumnType,
  ColumnDefinition,
  TableSchema,
  QueryResult,
  QueryExecutor,
  WarehouseConnector,
  SyncMode,
  SyncOptions,
  SyncResult,
  SchemaChangeType,
  SchemaChange,
  SchemaEvolutionResult,
} from './types.js';

// Base
export { BaseConnector } from './connectors/BaseConnector.js';

// Connectors
export { SnowflakeConnector } from './connectors/SnowflakeConnector.js';
export { BigQueryConnector } from './connectors/BigQueryConnector.js';
export { RedshiftConnector } from './connectors/RedshiftConnector.js';

// Connector configs
export type { SnowflakeConfig } from './connectors/SnowflakeConnector.js';
export type { BigQueryConfig } from './connectors/BigQueryConnector.js';
export type { RedshiftConfig } from './connectors/RedshiftConnector.js';

// Sync
export { DataSyncManager } from './DataSyncManager.js';

// Schema evolution
export { SchemaEvolutionManager } from './SchemaEvolutionManager.js';
