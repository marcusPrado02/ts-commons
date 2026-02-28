/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { IncidentManager } from './IncidentManager';
import { PostMortemBuilder } from './PostMortemBuilder';
import { PagerDutyAdapter, OpsgenieAdapter } from './AlertAdapters';

// ──────────────────────────────────────────────────────────────────────────────
// IncidentManager
// ──────────────────────────────────────────────────────────────────────────────

describe('IncidentManager', () => {
  it('opens a new incident', () => {
    const mgr = new IncidentManager();
    const inc = mgr.open({
      title: 'DB down',
      description: 'Primary DB unreachable',
      severity: 'critical',
    });
    expect(inc.id.startsWith('inc_')).toBe(true);
    expect(inc.status).toBe('open');
    expect(inc.severity).toBe('critical');
  });

  it('get returns the incident', () => {
    const mgr = new IncidentManager();
    const inc = mgr.open({ title: 'Test', description: 'Desc', severity: 'low' });
    expect(mgr.get(inc.id)?.id).toBe(inc.id);
  });

  it('get returns null for unknown id', () => {
    const mgr = new IncidentManager();
    expect(mgr.get('unknown')).toBeNull();
  });

  it('update changes status', () => {
    const mgr = new IncidentManager();
    const inc = mgr.open({ title: 'Test', description: 'Desc', severity: 'high' });
    mgr.update(inc.id, 'investigating', 'Looking into it');
    expect(mgr.get(inc.id)?.status).toBe('investigating');
  });

  it('resolve sets status to resolved with resolvedAt', () => {
    const mgr = new IncidentManager();
    const inc = mgr.open({ title: 'Test', description: 'Desc', severity: 'medium' });
    mgr.resolve(inc.id);
    const resolved = mgr.get(inc.id);
    expect(resolved?.status).toBe('resolved');
    expect(resolved?.resolvedAt).toBeDefined();
  });

  it('list filters by status', () => {
    const mgr = new IncidentManager();
    const inc = mgr.open({ title: 'A', description: 'D', severity: 'low' });
    mgr.open({ title: 'B', description: 'D', severity: 'critical' });
    mgr.resolve(inc.id);
    expect(mgr.list('open').length).toBe(1);
    expect(mgr.list('resolved').length).toBe(1);
  });

  it('openCount excludes resolved incidents', () => {
    const mgr = new IncidentManager();
    const inc = mgr.open({ title: 'A', description: '', severity: 'low' });
    mgr.open({ title: 'B', description: '', severity: 'critical' });
    mgr.resolve(inc.id);
    expect(mgr.openCount).toBe(1);
  });

  it('getUpdates returns history', () => {
    const mgr = new IncidentManager();
    const inc = mgr.open({ title: 'T', description: 'D', severity: 'high' });
    mgr.update(inc.id, 'investigating', 'Working on it');
    mgr.update(inc.id, 'identified', 'Found root cause');
    expect(mgr.getUpdates(inc.id).length).toBe(2);
  });

  it('onStatusChange handler is called on update', () => {
    const mgr = new IncidentManager();
    const inc = mgr.open({ title: 'T', description: 'D', severity: 'high' });
    const handler = vi.fn();
    mgr.onStatusChange(handler);
    mgr.update(inc.id, 'investigating', 'msg');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('unsubscribing stops status change handler', () => {
    const mgr = new IncidentManager();
    const inc = mgr.open({ title: 'T', description: 'D', severity: 'high' });
    const handler = vi.fn();
    const unsub = mgr.onStatusChange(handler);
    unsub();
    mgr.update(inc.id, 'investigating', 'msg');
    expect(handler).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// PostMortemBuilder
// ──────────────────────────────────────────────────────────────────────────────

describe('PostMortemBuilder', () => {
  function makeIncident() {
    const mgr = new IncidentManager();
    return mgr.open({
      title: 'DB outage',
      description: 'Primary DB went down',
      severity: 'critical',
    });
  }

  it('builds a post-mortem', () => {
    const inc = makeIncident();
    const pm = new PostMortemBuilder(inc)
      .summary('Database primary failed due to disk I/O saturation')
      .addEvent(new Date('2024-01-01T12:00:00Z'), 'Alert fired')
      .addRootCause('Disk filled up')
      .addActionItem('Add disk monitoring', 'alice')
      .build();
    expect(pm.incidentId).toBe(inc.id);
    expect(pm.rootCauses).toContain('Disk filled up');
    expect(pm.actionItems.length).toBe(1);
    expect(pm.timeline.length).toBe(1);
  });

  it('toMarkdown includes all sections', () => {
    const inc = makeIncident();
    const md = new PostMortemBuilder(inc)
      .summary('Summary text')
      .addRootCause('Root cause 1')
      .addActionItem('Fix it')
      .toMarkdown();
    expect(md).toContain('# Post-Mortem');
    expect(md).toContain('## Root Causes');
    expect(md).toContain('## Action Items');
    expect(md).toContain('Fix it');
  });

  it('toMarkdown contains summary', () => {
    const inc = makeIncident();
    const md = new PostMortemBuilder(inc).summary('Summary text').toMarkdown();
    expect(md).toContain('Summary text');
  });

  it('timeline is sorted chronologically', () => {
    const inc = makeIncident();
    const pm = new PostMortemBuilder(inc)
      .addEvent(new Date('2024-01-01T13:00:00Z'), 'Later event')
      .addEvent(new Date('2024-01-01T12:00:00Z'), 'Earlier event')
      .build();
    expect(pm.timeline[0].description).toBe('Earlier event');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// PagerDuty + Opsgenie adapters
// ──────────────────────────────────────────────────────────────────────────────

function makeFetch(data: Record<string, unknown>, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });
}

describe('PagerDutyAdapter', () => {
  it('trigger returns dedup key', async () => {
    const fetch = makeFetch({ dedup_key: 'abc123' });
    const adapter = new PagerDutyAdapter('key123', fetch);
    const key = await adapter.trigger({
      title: 'DB down',
      body: 'Primary DB is down',
      severity: 'critical',
      dedupKey: 'abc123',
    });
    expect(key).toBe('abc123');
  });

  it('trigger throws on non-ok response', async () => {
    const fetch = makeFetch({}, 400);
    const adapter = new PagerDutyAdapter('key', fetch);
    await expect(adapter.trigger({ title: 'X', body: 'Y', severity: 'low' })).rejects.toThrow();
  });

  it('resolve calls pagerduty with resolve action', async () => {
    const fetch = makeFetch({});
    const adapter = new PagerDutyAdapter('key', fetch);
    await adapter.resolve('dedup1');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('acknowledge calls pagerduty with acknowledge action', async () => {
    const fetch = makeFetch({});
    const adapter = new PagerDutyAdapter('key', fetch);
    await adapter.acknowledge('dedup1');
    expect(fetch).toHaveBeenCalledOnce();
  });
});

describe('OpsgenieAdapter', () => {
  it('trigger returns requestId', async () => {
    const fetch = makeFetch({ requestId: 'req1' });
    const adapter = new OpsgenieAdapter('apikey', fetch);
    const id = await adapter.trigger({
      title: 'Alert',
      body: 'Something failed',
      severity: 'high',
    });
    expect(id).toBe('req1');
  });

  it('resolve calls opsgenie close endpoint', async () => {
    const fetch = makeFetch({});
    const adapter = new OpsgenieAdapter('apikey', fetch);
    await adapter.resolve('alias1');
    expect(fetch.mock.calls[0][0] as string).toContain('close');
  });

  it('acknowledge calls opsgenie acknowledge endpoint', async () => {
    const fetch = makeFetch({});
    const adapter = new OpsgenieAdapter('apikey', fetch);
    await adapter.acknowledge('alias1');
    expect(fetch.mock.calls[0][0] as string).toContain('acknowledge');
  });
});
