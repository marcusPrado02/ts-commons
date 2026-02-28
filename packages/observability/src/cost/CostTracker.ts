import type {
  CostAllocationTag,
  CostSummary,
  IdleResourceReport,
  ResourceUsageRecord,
  RightSizingRecommendation,
} from './types';

const HOURS_PER_MONTH = 730;
const IDLE_CPU_THRESHOLD = 0.05;
const IDLE_MEMORY_THRESHOLD = 0.1;
const IDLE_DURATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * Tracks resource usage and generates cost optimisation reports.
 */
export class CostTracker {
  private readonly records: ResourceUsageRecord[] = [];
  private readonly tags = new Map<string, CostAllocationTag[]>();

  record(usage: ResourceUsageRecord): void {
    this.records.push(usage);
  }

  tag(resourceId: string, key: string, value: string): void {
    const existing = this.tags.get(resourceId) ?? [];
    const idx = existing.findIndex((t) => t.key === key);
    if (idx >= 0) {
      existing[idx] = { key, value, resourceId };
    } else {
      existing.push({ key, value, resourceId });
    }
    this.tags.set(resourceId, existing);
  }

  getTags(resourceId: string): CostAllocationTag[] {
    return this.tags.get(resourceId) ?? [];
  }

  detectIdleResources(): IdleResourceReport[] {
    const latestByResource = new Map<string, ResourceUsageRecord>();
    for (const r of this.records) {
      const existing = latestByResource.get(r.resourceId);
      if (existing == null || r.timestamp > existing.timestamp) {
        latestByResource.set(r.resourceId, r);
      }
    }
    const now = Date.now();
    const reports: IdleResourceReport[] = [];
    for (const record of latestByResource.values()) {
      const idle =
        record.cpuUtilization < IDLE_CPU_THRESHOLD &&
        record.memoryUtilization < IDLE_MEMORY_THRESHOLD;
      const idleSinceMs = now - record.timestamp.getTime();
      if (idle && idleSinceMs >= IDLE_DURATION_MS) {
        reports.push({
          resourceId: record.resourceId,
          resourceType: record.resourceType,
          service: record.service,
          idleSinceMs,
          estimatedMonthlyCost: record.costPerHour * HOURS_PER_MONTH,
        });
      }
    }
    return reports;
  }

  getRightSizingRecommendations(): RightSizingRecommendation[] {
    const avgByResource = this.computeAverageUtilization();
    const recommendations: RightSizingRecommendation[] = [];
    for (const [resourceId, avg] of avgByResource) {
      const rec = this.buildRecommendation(resourceId, avg);
      if (rec != null) recommendations.push(rec);
    }
    return recommendations;
  }

  getSummary(): CostSummary {
    const byService: Record<string, number> = {};
    const byRegion: Record<string, number> = {};
    let totalMonthlyCost = 0;

    const latest = this.latestPerResource();
    for (const r of latest.values()) {
      const monthly = r.costPerHour * HOURS_PER_MONTH;
      totalMonthlyCost += monthly;
      byService[r.service] = (byService[r.service] ?? 0) + monthly;
      byRegion[r.region] = (byRegion[r.region] ?? 0) + monthly;
    }

    const idle = this.detectIdleResources();
    const idleResourcesCost = idle.reduce((s, r) => s + r.estimatedMonthlyCost, 0);
    const recommendations = this.getRightSizingRecommendations();
    const potentialSavings =
      idleResourcesCost +
      recommendations.reduce(
        (s, r) =>
          s + (r.estimatedSavingsPercentage / 100) * (totalMonthlyCost / recommendations.length),
        0,
      );

    return { totalMonthlyCost, byService, byRegion, idleResourcesCost, potentialSavings };
  }

  private latestPerResource(): Map<string, ResourceUsageRecord> {
    const map = new Map<string, ResourceUsageRecord>();
    for (const r of this.records) {
      const existing = map.get(r.resourceId);
      if (existing == null || r.timestamp > existing.timestamp) {
        map.set(r.resourceId, r);
      }
    }
    return map;
  }

  private computeAverageUtilization(): Map<string, { cpu: number; memory: number; count: number }> {
    const map = new Map<string, { cpu: number; memory: number; count: number }>();
    for (const r of this.records) {
      const existing = map.get(r.resourceId) ?? { cpu: 0, memory: 0, count: 0 };
      map.set(r.resourceId, {
        cpu: existing.cpu + r.cpuUtilization,
        memory: existing.memory + r.memoryUtilization,
        count: existing.count + 1,
      });
    }
    for (const [id, v] of map) {
      map.set(id, { cpu: v.cpu / v.count, memory: v.memory / v.count, count: v.count });
    }
    return map;
  }

  private buildRecommendation(
    resourceId: string,
    avg: { cpu: number; memory: number },
  ): RightSizingRecommendation | null {
    // Over-provisioned: both CPU and memory < 30% average → downsize
    if (avg.cpu < 0.3 && avg.memory < 0.3) {
      return {
        resourceId,
        currentSize: 'large',
        recommendedSize: 'small',
        estimatedSavingsPercentage: 50,
        reason: `Average CPU ${(avg.cpu * 100).toFixed(0)}% and memory ${(avg.memory * 100).toFixed(0)}% usage is well below capacity`,
      };
    }
    return null;
  }
}
