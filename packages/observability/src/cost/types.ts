/**
 * Cost optimization types for @acme/observability.
 */

export interface ResourceUsageRecord {
  resourceId: string;
  resourceType: string;
  service: string;
  region: string;
  costPerHour: number;
  cpuUtilization: number; // 0–1
  memoryUtilization: number; // 0–1
  timestamp: Date;
}

export interface CostAllocationTag {
  key: string;
  value: string;
  resourceId: string;
}

export interface IdleResourceReport {
  resourceId: string;
  resourceType: string;
  service: string;
  idleSinceMs: number;
  estimatedMonthlyCost: number;
}

export interface RightSizingRecommendation {
  resourceId: string;
  currentSize: string;
  recommendedSize: string;
  estimatedSavingsPercentage: number;
  reason: string;
}

export interface CostSummary {
  totalMonthlyCost: number;
  byService: Record<string, number>;
  byRegion: Record<string, number>;
  idleResourcesCost: number;
  potentialSavings: number;
}
