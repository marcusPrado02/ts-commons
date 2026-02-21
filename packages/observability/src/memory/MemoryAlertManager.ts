import type { MemoryAlertRule, MemoryAlert, HeapSnapshot } from './MemoryTypes';

/** Pseudo-RSS snapshot accepted by the alert manager. */
export interface RssSnapshot {
  readonly rssBytes: number;
  readonly capturedAt: Date;
}

/** Combined snapshot type that MemoryAlertManager can evaluate. */
export type AlertSnapshot = HeapSnapshot & { readonly rssBytes?: number };

function extractMetric(snapshot: AlertSnapshot, metric: MemoryAlertRule['metric']): number {
  if (metric === 'heapUsed') return snapshot.heapUsedBytes;
  if (metric === 'heapTotal') return snapshot.heapTotalBytes;
  if (metric === 'external') return snapshot.externalBytes;
  return snapshot.rssBytes ?? 0;
}

/**
 * Evaluates heap / RSS snapshots against declared alert rules and records
 * every threshold breach.
 *
 * @example
 * ```typescript
 * const manager = new MemoryAlertManager();
 * manager.addRule({ name: 'heap-high', thresholdBytes: 512_000_000, metric: 'heapUsed' });
 * manager.evaluate(snapshot);
 * const alerts = manager.getAlerts();
 * ```
 */
export class MemoryAlertManager {
  private readonly rules = new Map<string, MemoryAlertRule>();
  private readonly alerts: MemoryAlert[] = [];

  addRule(rule: MemoryAlertRule): void {
    this.rules.set(rule.name, { ...rule });
  }

  removeRule(name: string): boolean {
    return this.rules.delete(name);
  }

  hasRule(name: string): boolean {
    return this.rules.has(name);
  }

  getRules(): MemoryAlertRule[] {
    return [...this.rules.values()].map((r) => ({ ...r }));
  }

  ruleCount(): number {
    return this.rules.size;
  }

  /** Evaluate a snapshot against all registered rules and record any breaches. */
  evaluate(snapshot: AlertSnapshot): void {
    for (const rule of this.rules.values()) {
      const actual = extractMetric(snapshot, rule.metric);
      if (actual > rule.thresholdBytes) {
        this.alerts.push({
          rule: rule.name,
          firedAt: snapshot.capturedAt,
          thresholdBytes: rule.thresholdBytes,
          actualBytes: actual,
          overageBytes: actual - rule.thresholdBytes,
        });
      }
    }
  }

  getAlerts(): MemoryAlert[] {
    return [...this.alerts];
  }

  getAlertsByRule(ruleName: string): MemoryAlert[] {
    return this.alerts.filter((a) => a.rule === ruleName);
  }

  hasAlerts(): boolean {
    return this.alerts.length > 0;
  }

  alertCount(): number {
    return this.alerts.length;
  }

  clearAlerts(): void {
    this.alerts.splice(0, this.alerts.length);
  }

  clear(): void {
    this.rules.clear();
    this.clearAlerts();
  }
}
