/**
 * Green computing / sustainability types.
 */

export interface CarbonUsageRecord {
  resourceId: string;
  region: string;
  energyKwh: number;
  carbonGramsCo2: number;
  timestamp: Date;
}

export interface RegionCarbonIntensity {
  region: string;
  /** gCO2eq per kWh */
  gramsPerKwh: number;
  /** Renewable energy percentage (0–100) */
  renewablePercentage: number;
}

export interface CarbonSummary {
  totalCarbonGrams: number;
  totalEnergyKwh: number;
  byRegion: Record<string, number>;
  mostSustainableRegion: string | null;
}

export interface OffPeakScheduleResult {
  resourceId: string;
  scheduledAt: Date;
  reason: string;
}
