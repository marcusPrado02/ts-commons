// Repository
export type {
  RepositoryPort,
  ReadRepositoryPort,
  WriteRepositoryPort,
} from './repository/RepositoryPort';

// Paging
export type { Page, PageRequest, Sort } from './paging/Page';

// Query optimization (Item 49)
export type {
  QueryRecord,
  QueryAnalysis,
  N1Pattern,
  IndexRecommendation,
  QueryPlanStep,
  QueryPlan,
  PoolSnapshot,
  PoolRecommendationType,
  PoolRecommendation,
} from './query/QueryTypes';
export { DataLoader } from './query/DataLoader';
export { N1Detector } from './query/N1Detector';
export { QueryResultCache } from './query/QueryResultCache';
export { ConnectionPoolMonitor } from './query/ConnectionPoolMonitor';
export { QueryPlanner } from './query/QueryPlanner';
