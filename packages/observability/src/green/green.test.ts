/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from 'vitest';
import { GreenComputingTracker } from './GreenComputingTracker';
import type { CarbonUsageRecord, RegionCarbonIntensity } from './types';

function makeRecord(overrides: Partial<CarbonUsageRecord> = {}): CarbonUsageRecord {
  return {
    resourceId: 'res-001',
    region: 'us-east-1',
    energyKwh: 1.5,
    carbonGramsCo2: 450,
    timestamp: new Date(),
    ...overrides,
  };
}

const lowCarbonRegion: RegionCarbonIntensity = {
  region: 'eu-north-1',
  gramsPerKwh: 8,
  renewablePercentage: 95,
};

const highCarbonRegion: RegionCarbonIntensity = {
  region: 'us-east-1',
  gramsPerKwh: 400,
  renewablePercentage: 15,
};

describe('GreenComputingTracker', () => {
  it('getSummary aggregates totals', () => {
    const tracker = new GreenComputingTracker();
    tracker.recordUsage(makeRecord({ energyKwh: 2, carbonGramsCo2: 600 }));
    tracker.recordUsage(makeRecord({ energyKwh: 1, carbonGramsCo2: 300 }));
    const summary = tracker.getSummary();
    expect(summary.totalEnergyKwh).toBe(3);
    expect(summary.totalCarbonGrams).toBe(900);
  });

  it('getSummary groups byRegion', () => {
    const tracker = new GreenComputingTracker();
    tracker.recordUsage(makeRecord({ region: 'eu-north-1', carbonGramsCo2: 100 }));
    tracker.recordUsage(makeRecord({ region: 'us-east-1', carbonGramsCo2: 400 }));
    const summary = tracker.getSummary();
    expect(summary.byRegion['eu-north-1']).toBe(100);
    expect(summary.byRegion['us-east-1']).toBe(400);
  });

  it('getMostSustainableRegion returns lowest emission region', () => {
    const tracker = new GreenComputingTracker();
    tracker.registerRegion(highCarbonRegion);
    tracker.registerRegion(lowCarbonRegion);
    expect(tracker.getMostSustainableRegion()).toBe('eu-north-1');
  });

  it('getMostSustainableRegion returns null with no regions', () => {
    const tracker = new GreenComputingTracker();
    expect(tracker.getMostSustainableRegion()).toBeNull();
  });

  it('getEnergyEfficiencyMetrics computes carbonPerHour', () => {
    const tracker = new GreenComputingTracker();
    tracker.recordUsage(makeRecord({ resourceId: 'r1', carbonGramsCo2: 100 }));
    tracker.recordUsage(makeRecord({ resourceId: 'r1', carbonGramsCo2: 200 }));
    const metrics = tracker.getEnergyEfficiencyMetrics();
    const r1 = metrics.find((m) => m.resourceId === 'r1');
    expect(r1?.carbonPerHour).toBe(150);
  });

  it('scheduleOffPeak creates a future scheduled job', () => {
    const tracker = new GreenComputingTracker();
    const result = tracker.scheduleOffPeak('res-001', 'carbon saving');
    expect(result.resourceId).toBe('res-001');
    expect(result.scheduledAt > new Date()).toBe(true);
    expect(tracker.getScheduledJobs().length).toBe(1);
  });

  it('getSummary includes mostSustainableRegion', () => {
    const tracker = new GreenComputingTracker();
    tracker.registerRegion(lowCarbonRegion);
    tracker.recordUsage(makeRecord());
    const summary = tracker.getSummary();
    expect(summary.mostSustainableRegion).toBe('eu-north-1');
  });
});
