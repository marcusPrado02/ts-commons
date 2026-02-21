/** A single recorded query execution. */
export interface QueryRecord {
  query: string;
  durationMs: number;
  timestamp: number;
  rowCount?: number;
}

/** Aggregated analysis of recorded queries. */
export interface QueryAnalysis {
  totalQueries: number;
  averageDurationMs: number;
  slowQueries: QueryRecord[];
  n1Patterns: N1Pattern[];
}

/** Detected N+1 query pattern. */
export interface N1Pattern {
  query: string;
  count: number;
  windowMs: number;
}

/** Recommendation for adding a database index. */
export interface IndexRecommendation {
  table: string;
  columns: readonly string[];
  reason: string;
  estimatedImprovementMs: number;
}

/** One step in a query execution plan. */
export interface QueryPlanStep {
  operation: string;
  table?: string;
  cost: number;
  rows?: number;
}

/** Full query execution plan. */
export interface QueryPlan {
  query: string;
  totalCost: number;
  steps: readonly QueryPlanStep[];
}

/** Snapshot of connection pool state at a point in time. */
export interface PoolSnapshot {
  total: number;
  active: number;
  idle: number;
  waiting: number;
  timestamp: number;
}

/** Possible pool tuning recommendations. */
export type PoolRecommendationType = 'increase-pool-size' | 'decrease-pool-size' | 'ok';

/** A single pool tuning recommendation. */
export interface PoolRecommendation {
  type: PoolRecommendationType;
  reason: string;
}
