import type { IndexRecommendation, QueryPlan, QueryPlanStep } from './QueryTypes';

/**
 * Builds simple query execution plans and derives index recommendations
 * from recorded slow query patterns.
 *
 * In production you would parse real EXPLAIN output; here the planner
 * provides an analyzable in-process model suitable for testing and tooling
 * built on top of `@acme/persistence`.
 *
 * @example
 * ```typescript
 * const planner = new QueryPlanner();
 *
 * planner.recordSlowQuery('SELECT * FROM orders WHERE customer_id = ?', 850, 'orders');
 * planner.recordSlowQuery('SELECT * FROM orders WHERE customer_id = ?', 920, 'orders');
 *
 * const recs = planner.recommendIndexes(500); // queries slower than 500 ms
 * // → [{ table: 'orders', columns: ['customer_id'], reason: '...', ... }]
 * ```
 */
export class QueryPlanner {
  private readonly slowLogs: SlowLog[] = [];

  /**
   * Record a slow query execution for later analysis.
   *
   * @param query      - Raw SQL or query string.
   * @param durationMs - How long the query took.
   * @param table      - Primary table being queried.
   */
  recordSlowQuery(query: string, durationMs: number, table: string): void {
    this.slowLogs.push({ query, durationMs, table, timestamp: Date.now() });
  }

  /**
   * Derive index recommendations from queries slower than `thresholdMs`.
   *
   * The planner extracts column names from simple `WHERE col = ?` patterns
   * and groups repeated slow queries on the same table/column combination.
   */
  recommendIndexes(thresholdMs: number): IndexRecommendation[] {
    const slow = this.slowLogs.filter((l): boolean => l.durationMs > thresholdMs);
    const grouped = groupByTableAndColumns(slow);
    return grouped.map(buildRecommendation);
  }

  /**
   * Build a simple multi-step execution plan for a query string.
   *
   * The plan includes a seq-scan step followed by an optional filter step
   * when a WHERE clause is detected.
   */
  buildPlan(query: string, table: string, estimatedRows?: number): QueryPlan {
    const steps = buildSteps(query, table, estimatedRows);
    const totalCost = steps.reduce((sum: number, s: QueryPlanStep): number => sum + s.cost, 0);
    return { query, totalCost, steps };
  }

  /** All recorded slow logs (returns a copy). */
  getSlowLogs(): readonly SlowLog[] {
    return [...this.slowLogs];
  }

  /** Clear all recorded slow logs. */
  clear(): void {
    this.slowLogs.length = 0;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface SlowLog {
  query: string;
  durationMs: number;
  table: string;
  timestamp: number;
}

interface GroupedSlow {
  table: string;
  columns: string[];
  avgDurationMs: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupByTableAndColumns(logs: SlowLog[]): GroupedSlow[] {
  const map = new Map<string, { durations: number[]; columns: Set<string> }>();
  for (const log of logs) {
    const key = log.table;
    const existing = map.get(key) ?? { durations: [], columns: new Set<string>() };
    existing.durations.push(log.durationMs);
    for (const col of extractColumns(log.query)) {
      existing.columns.add(col);
    }
    map.set(key, existing);
  }
  const result: GroupedSlow[] = [];
  for (const [table, { durations, columns }] of map.entries()) {
    const avgDurationMs =
      durations.reduce((s: number, d: number): number => s + d, 0) / durations.length;
    result.push({ table, columns: Array.from(columns), avgDurationMs });
  }
  return result;
}

function extractColumns(query: string): string[] {
  const cols: string[] = [];
  const re = /where\s+(\w+)\s*=/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(query)) !== null) {
    const col = match[1];
    if (col !== undefined) cols.push(col.toLowerCase());
  }
  return cols;
}

function buildRecommendation(g: GroupedSlow): IndexRecommendation {
  const cols = g.columns.length > 0 ? g.columns : ['id'];
  return {
    table: g.table,
    columns: cols,
    reason: `Avg query duration ${g.avgDurationMs.toFixed(0)}ms on ${g.table}`,
    estimatedImprovementMs: Math.round(g.avgDurationMs * 0.7),
  };
}

function buildSteps(query: string, table: string, estimatedRows?: number): QueryPlanStep[] {
  const rows = estimatedRows ?? 1000;
  const scanStep: QueryPlanStep = { operation: 'Seq Scan', table, cost: rows, rows };
  const lower = query.toLowerCase();
  if (!lower.includes('where')) return [scanStep];
  const filterStep: QueryPlanStep = { operation: 'Filter', cost: Math.round(rows * 0.1) };
  return [scanStep, filterStep];
}
