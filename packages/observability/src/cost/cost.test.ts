/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from 'vitest';
import { CostTracker } from './CostTracker';
import type { ResourceUsageRecord } from './types';

function makeRecord(overrides: Partial<ResourceUsageRecord> = {}): ResourceUsageRecord {
  return {
    resourceId: 'res-001',
    resourceType: 'vm',
    service: 'api',
    region: 'us-east-1',
    costPerHour: 0.1,
    cpuUtilization: 0.5,
    memoryUtilization: 0.5,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    ...overrides,
  };
}

describe('CostTracker', () => {
  it('records usage and includes in summary', () => {
    const tracker = new CostTracker();
    tracker.record(makeRecord());
    const summary = tracker.getSummary();
    expect(summary.totalMonthlyCost).toBeGreaterThan(0);
  });

  it('getSummary groups by service', () => {
    const tracker = new CostTracker();
    tracker.record(makeRecord({ service: 'api' }));
    tracker.record(makeRecord({ resourceId: 'res-002', service: 'worker' }));
    const summary = tracker.getSummary();
    expect(summary.byService['api']).toBeGreaterThan(0);
    expect(summary.byService['worker']).toBeGreaterThan(0);
  });

  it('getSummary groups by region', () => {
    const tracker = new CostTracker();
    tracker.record(makeRecord({ region: 'eu-west-1' }));
    const summary = tracker.getSummary();
    expect(summary.byRegion['eu-west-1']).toBeGreaterThan(0);
  });

  it('detectIdleResources finds idle resources', () => {
    const tracker = new CostTracker();
    tracker.record(makeRecord({ cpuUtilization: 0.01, memoryUtilization: 0.02 }));
    const idle = tracker.detectIdleResources();
    expect(idle.length).toBe(1);
    expect(idle[0].resourceId).toBe('res-001');
  });

  it('does not flag healthy resources as idle', () => {
    const tracker = new CostTracker();
    tracker.record(makeRecord({ cpuUtilization: 0.6, memoryUtilization: 0.5 }));
    expect(tracker.detectIdleResources().length).toBe(0);
  });

  it('does not flag recently-recorded idle resources', () => {
    const tracker = new CostTracker();
    // Recent timestamp — not idle long enough
    tracker.record(
      makeRecord({ cpuUtilization: 0.01, memoryUtilization: 0.02, timestamp: new Date() }),
    );
    expect(tracker.detectIdleResources().length).toBe(0);
  });

  it('getRightSizingRecommendations returns downsizing advice', () => {
    const tracker = new CostTracker();
    tracker.record(makeRecord({ cpuUtilization: 0.1, memoryUtilization: 0.1 }));
    const recs = tracker.getRightSizingRecommendations();
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].recommendedSize).toBe('small');
  });

  it('tag and getTags work', () => {
    const tracker = new CostTracker();
    tracker.tag('res-001', 'env', 'prod');
    tracker.tag('res-001', 'team', 'platform');
    const tags = tracker.getTags('res-001');
    expect(tags.length).toBe(2);
    expect(tags.find((t) => t.key === 'env')?.value).toBe('prod');
  });

  it('tag overwrite updates existing tag', () => {
    const tracker = new CostTracker();
    tracker.tag('res-001', 'env', 'dev');
    tracker.tag('res-001', 'env', 'prod');
    const tags = tracker.getTags('res-001');
    expect(tags.filter((t) => t.key === 'env').length).toBe(1);
    expect(tags[0].value).toBe('prod');
  });
});
