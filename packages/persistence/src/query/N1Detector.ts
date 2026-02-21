import type { N1Pattern } from './QueryTypes';

interface CallRecord {
  timestamp: number;
}

/**
 * Detects N+1 query patterns by tracking repeated calls to the same
 * normalized query string within a time window.
 *
 * @example
 * ```typescript
 * const detector = new N1Detector();
 *
 * // Inside a request handler that loads N records, each triggering a sub-query:
 * for (const post of posts) {
 *   detector.record(`SELECT * FROM comments WHERE post_id = ?`);
 *   // ... execute query
 * }
 *
 * const patterns = detector.detect(1000, 5); // window 1s, threshold 5
 * if (patterns.length > 0) {
 *   console.warn('N+1 detected', patterns);
 * }
 * ```
 */
export class N1Detector {
  private readonly calls = new Map<string, CallRecord[]>();

  /** Record a query execution. The query string is normalized before tracking. */
  record(query: string): void {
    const key = normalize(query);
    const list = this.calls.get(key) ?? [];
    list.push({ timestamp: Date.now() });
    this.calls.set(key, list);
  }

  /**
   * Return patterns where the same query was called ≥ `threshold` times
   * within the last `windowMs` milliseconds.
   */
  detect(windowMs: number, threshold: number): N1Pattern[] {
    const now = Date.now();
    const patterns: N1Pattern[] = [];
    for (const [query, records] of this.calls.entries()) {
      const recent = records.filter((r): boolean => now - r.timestamp <= windowMs);
      if (recent.length >= threshold) {
        patterns.push({ query, count: recent.length, windowMs });
      }
    }
    return patterns;
  }

  /** Prune stale call records older than `windowMs`. */
  prune(windowMs: number): void {
    const cutoff = Date.now() - windowMs;
    for (const [query, records] of this.calls.entries()) {
      const fresh = records.filter((r): boolean => r.timestamp >= cutoff);
      if (fresh.length === 0) {
        this.calls.delete(query);
      } else {
        this.calls.set(query, fresh);
      }
    }
  }

  /** Number of distinct normalized queries tracked. */
  trackedQueryCount(): number {
    return this.calls.size;
  }

  /** Clear all tracked data. */
  clear(): void {
    this.calls.clear();
  }
}

function normalize(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}
