import type {
  CarbonSummary,
  CarbonUsageRecord,
  OffPeakScheduleResult,
  RegionCarbonIntensity,
} from './types';

/**
 * Tracks carbon footprint and energy usage, and provides
 * green computing recommendations.
 */
export class GreenComputingTracker {
  private readonly usageRecords: CarbonUsageRecord[] = [];
  private readonly regionIntensity = new Map<string, RegionCarbonIntensity>();
  private readonly scheduledJobs: OffPeakScheduleResult[] = [];

  registerRegion(intensity: RegionCarbonIntensity): void {
    this.regionIntensity.set(intensity.region, intensity);
  }

  recordUsage(record: CarbonUsageRecord): void {
    this.usageRecords.push(record);
  }

  getSummary(): CarbonSummary {
    const byRegion: Record<string, number> = {};
    let totalCarbonGrams = 0;
    let totalEnergyKwh = 0;

    for (const r of this.usageRecords) {
      totalCarbonGrams += r.carbonGramsCo2;
      totalEnergyKwh += r.energyKwh;
      byRegion[r.region] = (byRegion[r.region] ?? 0) + r.carbonGramsCo2;
    }

    return {
      totalCarbonGrams,
      totalEnergyKwh,
      byRegion,
      mostSustainableRegion: this.getMostSustainableRegion(),
    };
  }

  getMostSustainableRegion(): string | null {
    if (this.regionIntensity.size === 0) return null;
    let best: RegionCarbonIntensity | null = null;
    for (const r of this.regionIntensity.values()) {
      if (best == null || r.gramsPerKwh < best.gramsPerKwh) {
        best = r;
      }
    }
    return best?.region ?? null;
  }

  getEnergyEfficiencyMetrics(): Array<{ resourceId: string; carbonPerHour: number }> {
    const map = new Map<string, { carbon: number; count: number }>();
    for (const r of this.usageRecords) {
      const existing = map.get(r.resourceId) ?? { carbon: 0, count: 0 };
      map.set(r.resourceId, {
        carbon: existing.carbon + r.carbonGramsCo2,
        count: existing.count + 1,
      });
    }
    return Array.from(map.entries()).map(([resourceId, v]) => ({
      resourceId,
      carbonPerHour: v.carbon / v.count,
    }));
  }

  /** Schedule a workload to run at off-peak hours in a low-carbon region. */
  scheduleOffPeak(resourceId: string, reason = 'Low-carbon scheduling'): OffPeakScheduleResult {
    // Schedule at next 3am UTC (simplified)
    const now = new Date();
    const scheduledAt = new Date(now);
    scheduledAt.setUTCHours(3, 0, 0, 0);
    if (scheduledAt <= now) {
      scheduledAt.setUTCDate(scheduledAt.getUTCDate() + 1);
    }
    const result: OffPeakScheduleResult = { resourceId, scheduledAt, reason };
    this.scheduledJobs.push(result);
    return result;
  }

  getScheduledJobs(): OffPeakScheduleResult[] {
    return [...this.scheduledJobs];
  }
}
