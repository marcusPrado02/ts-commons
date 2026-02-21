import type { PoolSnapshot, PoolRecommendation, PoolRecommendationType } from './QueryTypes';

/**
 * Records connection pool snapshots and produces tuning recommendations.
 *
 * @example
 * ```typescript
 * const monitor = new ConnectionPoolMonitor();
 *
 * // Record pool state periodically:
 * monitor.record({ total: 10, active: 8, idle: 2, waiting: 5, timestamp: Date.now() });
 *
 * // Get recommendation:
 * const rec = monitor.recommend(2, 0.5); // maxWaiting=2, maxIdleRatio=50%
 * if (rec.type === 'increase-pool-size') { /* scale up *\/ }
 * ```
 */
export class ConnectionPoolMonitor {
  private readonly snapshots: PoolSnapshot[] = [];

  /** Record a pool state snapshot. */
  record(snapshot: PoolSnapshot): void {
    this.snapshots.push(snapshot);
  }

  /** All recorded snapshots (returns a copy). */
  getSnapshots(): readonly PoolSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Return a tuning recommendation based on the latest snapshot.
   *
   * @param maxWaitThreshold - Waiting connections above this number → increase pool.
   * @param maxIdleRatio     - Fraction of idle connections above this → decrease pool.
   */
  recommend(maxWaitThreshold: number, maxIdleRatio: number): PoolRecommendation {
    if (this.snapshots.length === 0) {
      return buildRec('ok', 'No data collected yet');
    }
    const latest = this.snapshots[this.snapshots.length - 1]!;
    return this.analyzeLatest(latest, maxWaitThreshold, maxIdleRatio);
  }

  /** Mean number of active connections across all snapshots. */
  averageActiveConnections(): number {
    if (this.snapshots.length === 0) return 0;
    const sum = this.snapshots.reduce((acc: number, s: PoolSnapshot): number => acc + s.active, 0);
    return sum / this.snapshots.length;
  }

  /** Highest `waiting` count seen across all snapshots. */
  peakWaiting(): number {
    if (this.snapshots.length === 0) return 0;
    return this.snapshots.reduce((max: number, s: PoolSnapshot): number => {
      return s.waiting > max ? s.waiting : max;
    }, 0);
  }

  /** Number of snapshots recorded. */
  snapshotCount(): number {
    return this.snapshots.length;
  }

  /** Clear all recorded data. */
  clear(): void {
    this.snapshots.length = 0;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private analyzeLatest(
    latest: PoolSnapshot,
    maxWait: number,
    maxIdleRatio: number,
  ): PoolRecommendation {
    if (latest.waiting > maxWait) {
      return buildRec(
        'increase-pool-size',
        `${latest.waiting} connections waiting (threshold ${maxWait})`,
      );
    }
    const idleRatio = latest.total > 0 ? latest.idle / latest.total : 0;
    if (idleRatio > maxIdleRatio && latest.total > 1) {
      const pct = (idleRatio * 100).toFixed(0);
      const thr = (maxIdleRatio * 100).toFixed(0);
      return buildRec('decrease-pool-size', `Idle ratio ${pct}% exceeds threshold ${thr}%`);
    }
    return buildRec('ok', 'Pool utilization looks healthy');
  }
}

function buildRec(type: PoolRecommendationType, reason: string): PoolRecommendation {
  return { type, reason };
}
