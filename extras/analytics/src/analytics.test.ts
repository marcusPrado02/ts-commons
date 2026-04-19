/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import {
  AnalyticsTracker,
  InMemoryProvider,
  SegmentProvider,
  MixpanelProvider,
  GoogleAnalytics4Provider,
  CustomDimensionRegistry,
  FunnelTracker,
} from './index.js';
import type { AnalyticsEvent, AnalyticsUser, PageView } from './index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const event: AnalyticsEvent = { name: 'Button Clicked', userId: 'u1', properties: { btn: 'cta' } };
const user: AnalyticsUser = { userId: 'u1', traits: { plan: 'pro' } };
const page: PageView = { name: 'Home', url: 'https://example.com', userId: 'u1' };

// ─── InMemoryProvider ─────────────────────────────────────────────────────────

describe('InMemoryProvider', () => {
  it('track() accumulates events', async () => {
    const p = new InMemoryProvider();
    await p.track(event);
    expect(p.getTracked()).toHaveLength(1);
    expect(p.getTracked()[0]?.name).toBe('Button Clicked');
  });

  it('identify() accumulates users', async () => {
    const p = new InMemoryProvider();
    await p.identify(user);
    expect(p.getIdentified()).toHaveLength(1);
    expect(p.getIdentified()[0]?.userId).toBe('u1');
  });

  it('page() accumulates page views', async () => {
    const p = new InMemoryProvider();
    await p.page(page);
    expect(p.getPages()).toHaveLength(1);
    expect(p.getPages()[0]?.name).toBe('Home');
  });

  it('clear() resets all calls', async () => {
    const p = new InMemoryProvider();
    await p.track(event);
    await p.identify(user);
    await p.page(page);
    p.clear();
    expect(p.getTracked()).toHaveLength(0);
    expect(p.getIdentified()).toHaveLength(0);
    expect(p.getPages()).toHaveLength(0);
  });

  it('name defaults to "in-memory"', () => {
    expect(new InMemoryProvider().name).toBe('in-memory');
  });

  it('name can be customized', () => {
    expect(new InMemoryProvider('custom').name).toBe('custom');
  });

  it('getTracked() returns a copy (does not expose internal array)', async () => {
    const p = new InMemoryProvider();
    await p.track(event);
    const copy = p.getTracked();
    copy.push(event);
    expect(p.getTracked()).toHaveLength(1);
  });
});

// ─── AnalyticsTracker ─────────────────────────────────────────────────────────

describe('AnalyticsTracker', () => {
  it('addProvider() is fluent', () => {
    const t = new AnalyticsTracker();
    expect(t.addProvider(new InMemoryProvider())).toBe(t);
  });

  it('providerCount() reflects registered providers', () => {
    const t = new AnalyticsTracker()
      .addProvider(new InMemoryProvider('a'))
      .addProvider(new InMemoryProvider('b'));
    expect(t.providerCount()).toBe(2);
  });

  it('track() dispatches to all providers', async () => {
    const p1 = new InMemoryProvider('a');
    const p2 = new InMemoryProvider('b');
    const t = new AnalyticsTracker().addProvider(p1).addProvider(p2);
    await t.track(event);
    expect(p1.getTracked()).toHaveLength(1);
    expect(p2.getTracked()).toHaveLength(1);
  });

  it('track() returns successCount matching provider count', async () => {
    const t = new AnalyticsTracker()
      .addProvider(new InMemoryProvider())
      .addProvider(new InMemoryProvider());
    const result = await t.track(event);
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);
  });

  it('track() captures provider failures without throwing', async () => {
    const failing: any = {
      name: 'failing',
      track: async () => {
        throw new Error('provider error');
      },
      identify: async () => undefined,
      page: async () => undefined,
    };
    const t = new AnalyticsTracker().addProvider(failing);
    const result = await t.track(event);
    expect(result.failureCount).toBe(1);
    expect(result.errors[0]?.message).toBe('provider error');
  });

  it('track() includes the original event in the result', async () => {
    const t = new AnalyticsTracker().addProvider(new InMemoryProvider());
    const result = await t.track(event);
    expect(result.event).toBe(event);
  });

  it('identify() dispatches to all providers', async () => {
    const p = new InMemoryProvider();
    const t = new AnalyticsTracker().addProvider(p);
    await t.identify(user);
    expect(p.getIdentified()).toHaveLength(1);
  });

  it('page() dispatches to all providers', async () => {
    const p = new InMemoryProvider();
    const t = new AnalyticsTracker().addProvider(p);
    await t.page(page);
    expect(p.getPages()).toHaveLength(1);
  });

  it('track() with no providers returns successCount=0', async () => {
    const t = new AnalyticsTracker();
    const result = await t.track(event);
    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(0);
  });
});

// ─── SegmentProvider ──────────────────────────────────────────────────────────

describe('SegmentProvider', () => {
  it('name is "segment"', () => {
    expect(new SegmentProvider({ writeKey: 'k' }).name).toBe('segment');
  });

  it('track() sends correct payload shape', async () => {
    const sender = vi.fn().mockResolvedValue(undefined);
    const p = new SegmentProvider({ writeKey: 'abc', sender });
    await p.track(event);
    const payload = sender.mock.calls[0]![0];
    expect(payload.type).toBe('track');
    expect(payload.writeKey).toBe('abc');
    expect(payload.event).toBe('Button Clicked');
    expect(payload.userId).toBe('u1');
    expect(payload.properties).toEqual({ btn: 'cta' });
  });

  it('identify() sends correct payload shape', async () => {
    const sender = vi.fn().mockResolvedValue(undefined);
    const p = new SegmentProvider({ writeKey: 'abc', sender });
    await p.identify(user);
    const payload = sender.mock.calls[0]![0];
    expect(payload.type).toBe('identify');
    expect(payload.userId).toBe('u1');
    expect(payload.traits).toEqual({ plan: 'pro' });
  });

  it('page() sends correct payload shape', async () => {
    const sender = vi.fn().mockResolvedValue(undefined);
    const p = new SegmentProvider({ writeKey: 'abc', sender });
    await p.page(page);
    const payload = sender.mock.calls[0]![0];
    expect(payload.type).toBe('page');
    expect(payload.name).toBe('Home');
  });
});

// ─── MixpanelProvider ─────────────────────────────────────────────────────────

describe('MixpanelProvider', () => {
  it('name is "mixpanel"', () => {
    expect(new MixpanelProvider({ token: 't' }).name).toBe('mixpanel');
  });

  it('track() sends event name correctly', async () => {
    const sender = vi.fn().mockResolvedValue(undefined);
    const p = new MixpanelProvider({ token: 'tok', sender });
    await p.track(event);
    const payload = sender.mock.calls[0]![0];
    expect(payload.event).toBe('Button Clicked');
    expect(payload.properties.token).toBe('tok');
    expect(payload.properties.distinct_id).toBe('u1');
  });

  it('identify() sends $token and $distinct_id', async () => {
    const sender = vi.fn().mockResolvedValue(undefined);
    const p = new MixpanelProvider({ token: 'tok', sender });
    await p.identify(user);
    const payload = sender.mock.calls[0]![0];
    expect(payload['$token']).toBe('tok');
    expect(payload['$distinct_id']).toBe('u1');
    expect(payload['$set']).toEqual({ plan: 'pro' });
  });

  it('page() sends $mp_web_page_view event', async () => {
    const sender = vi.fn().mockResolvedValue(undefined);
    const p = new MixpanelProvider({ token: 'tok', sender });
    await p.page(page);
    const payload = sender.mock.calls[0]![0];
    expect(payload.event).toBe('$mp_web_page_view');
    expect(payload.properties.current_page_title).toBe('Home');
    expect(payload.properties.current_url).toBe('https://example.com');
  });
});

// ─── GoogleAnalytics4Provider ─────────────────────────────────────────────────

describe('GoogleAnalytics4Provider', () => {
  const cfg = { measurementId: 'G-123', apiSecret: 'secret' };

  it('name is "ga4"', () => {
    expect(new GoogleAnalytics4Provider(cfg).name).toBe('ga4');
  });

  it('track() includes measurement_id and api_secret', async () => {
    const sender = vi.fn().mockResolvedValue(undefined);
    const p = new GoogleAnalytics4Provider({ ...cfg, sender });
    await p.track(event);
    const payload = sender.mock.calls[0]![0];
    expect(payload.measurement_id).toBe('G-123');
    expect(payload.api_secret).toBe('secret');
  });

  it('track() sanitizes event name to snake_case', async () => {
    const sender = vi.fn().mockResolvedValue(undefined);
    const p = new GoogleAnalytics4Provider({ ...cfg, sender });
    await p.track({ name: 'Button Clicked', userId: 'u1' });
    const payload = sender.mock.calls[0]![0];
    expect(payload.events[0].name).toBe('button_clicked');
  });

  it('identify() sends user_properties', async () => {
    const sender = vi.fn().mockResolvedValue(undefined);
    const p = new GoogleAnalytics4Provider({ ...cfg, sender });
    await p.identify(user);
    const payload = sender.mock.calls[0]![0];
    expect(payload.client_id).toBe('u1');
    expect(payload.user_properties).toEqual({ plan: 'pro' });
  });

  it('page() sends page_view event', async () => {
    const sender = vi.fn().mockResolvedValue(undefined);
    const p = new GoogleAnalytics4Provider({ ...cfg, sender });
    await p.page(page);
    const payload = sender.mock.calls[0]![0];
    expect(payload.events[0].name).toBe('page_view');
    expect(payload.events[0].params.page_title).toBe('Home');
    expect(payload.events[0].params.page_location).toBe('https://example.com');
  });
});

// ─── CustomDimensionRegistry ──────────────────────────────────────────────────

describe('CustomDimensionRegistry', () => {
  it('register() is fluent', () => {
    const r = new CustomDimensionRegistry();
    expect(r.register({ key: 'plan', label: 'Plan' })).toBe(r);
  });

  it('count() reflects registered dimensions', () => {
    const r = new CustomDimensionRegistry()
      .register({ key: 'plan', label: 'Plan' })
      .register({ key: 'region', label: 'Region' });
    expect(r.count()).toBe(2);
  });

  it('getAll() returns all dimensions (shallow copy)', () => {
    const r = new CustomDimensionRegistry().register({ key: 'plan', label: 'Plan' });
    expect(r.getAll()).toHaveLength(1);
    r.getAll().push({ key: 'extra', label: 'Extra' });
    expect(r.count()).toBe(1); // original unaffected
  });

  it('enrich() adds matching dimension values to properties', () => {
    const r = new CustomDimensionRegistry().register({ key: 'plan', label: 'Plan' });
    const enriched = r.enrich(event, { plan: 'pro', unrelated: 'x' });
    expect(enriched.properties?.['plan']).toBe('pro');
    expect(enriched.properties?.['unrelated']).toBeUndefined();
  });

  it('enrich() does not mutate the original event', () => {
    const r = new CustomDimensionRegistry().register({ key: 'plan', label: 'Plan' });
    r.enrich(event, { plan: 'pro' });
    expect(event.properties?.['plan']).toBeUndefined();
  });

  it('enrich() preserves existing properties', () => {
    const r = new CustomDimensionRegistry().register({ key: 'plan', label: 'Plan' });
    const enriched = r.enrich(event, { plan: 'pro' });
    expect(enriched.properties?.['btn']).toBe('cta');
  });

  it('enrich() ignores dimensions not present in context', () => {
    const r = new CustomDimensionRegistry()
      .register({ key: 'plan', label: 'Plan' })
      .register({ key: 'region', label: 'Region' });
    const enriched = r.enrich(event, { plan: 'pro' });
    expect(enriched.properties?.['region']).toBeUndefined();
  });

  it('find() returns the dimension by key', () => {
    const r = new CustomDimensionRegistry().register({ key: 'plan', label: 'Plan' });
    expect(r.find('plan')?.label).toBe('Plan');
  });

  it('find() returns undefined for unknown key', () => {
    const r = new CustomDimensionRegistry();
    expect(r.find('nope')).toBeUndefined();
  });
});

// ─── FunnelTracker ────────────────────────────────────────────────────────────

describe('FunnelTracker', () => {
  it('funnelCount() reflects created funnels', () => {
    const t = new FunnelTracker();
    t.createFunnel('onboarding', ['signup', 'verify']);
    expect(t.funnelCount()).toBe(1);
  });

  it('getResult() returns totalSteps matching funnel definition', () => {
    const t = new FunnelTracker();
    t.createFunnel('onboarding', ['signup', 'verify', 'complete']);
    const r = t.getResult('onboarding', 'u1');
    expect(r.totalSteps).toBe(3);
    expect(r.completedSteps).toBe(0);
  });

  it('recordStep() increments completedSteps', () => {
    const t = new FunnelTracker();
    t.createFunnel('f', ['a', 'b']);
    t.recordStep('f', 'u1', 'a');
    const r = t.getResult('f', 'u1');
    expect(r.completedSteps).toBe(1);
  });

  it('getResult() populates completedAt for recorded steps', () => {
    const t = new FunnelTracker();
    t.createFunnel('f', ['a']);
    t.recordStep('f', 'u1', 'a');
    const step = t.getResult('f', 'u1').steps[0];
    expect(step?.completedAt).toBeInstanceOf(Date);
  });

  it('getResult() completed=true when all steps recorded', () => {
    const t = new FunnelTracker();
    t.createFunnel('f', ['a', 'b']);
    t.recordStep('f', 'u1', 'a');
    t.recordStep('f', 'u1', 'b');
    expect(t.getResult('f', 'u1').completed).toBe(true);
  });

  it('getResult() completed=false when not all steps recorded', () => {
    const t = new FunnelTracker();
    t.createFunnel('f', ['a', 'b']);
    t.recordStep('f', 'u1', 'a');
    expect(t.getResult('f', 'u1').completed).toBe(false);
  });

  it('conversionRate is completedSteps/totalSteps', () => {
    const t = new FunnelTracker();
    t.createFunnel('f', ['a', 'b', 'c', 'd']);
    t.recordStep('f', 'u1', 'a');
    t.recordStep('f', 'u1', 'b');
    expect(t.getResult('f', 'u1').conversionRate).toBe(0.5);
  });

  it('conversionRate=1 for empty funnel', () => {
    const t = new FunnelTracker();
    t.createFunnel('empty', []);
    expect(t.getResult('empty', 'u1').conversionRate).toBe(1);
  });

  it('completed=false for empty funnel', () => {
    const t = new FunnelTracker();
    t.createFunnel('empty', []);
    expect(t.getResult('empty', 'u1').completed).toBe(false);
  });

  it('recordStep() throws for unknown funnel', () => {
    const t = new FunnelTracker();
    expect(() => t.recordStep('nope', 'u1', 'step')).toThrow(/nope/);
  });

  it('getResult() throws for unknown funnel', () => {
    const t = new FunnelTracker();
    expect(() => t.getResult('nope', 'u1')).toThrow(/nope/);
  });

  it('recordStep() throws for unknown step', () => {
    const t = new FunnelTracker();
    t.createFunnel('f', ['a']);
    expect(() => t.recordStep('f', 'u1', 'unknown-step')).toThrow(/unknown-step/);
  });

  it('resetUser() clears completions for that user', () => {
    const t = new FunnelTracker();
    t.createFunnel('f', ['a', 'b']);
    t.recordStep('f', 'u1', 'a');
    t.resetUser('f', 'u1');
    expect(t.getResult('f', 'u1').completedSteps).toBe(0);
  });

  it('different users have independent progress', () => {
    const t = new FunnelTracker();
    t.createFunnel('f', ['a', 'b']);
    t.recordStep('f', 'u1', 'a');
    t.recordStep('f', 'u2', 'a');
    t.recordStep('f', 'u2', 'b');
    expect(t.getResult('f', 'u1').completedSteps).toBe(1);
    expect(t.getResult('f', 'u2').completedSteps).toBe(2);
  });

  it('re-defining a funnel replaces the previous definition', () => {
    const t = new FunnelTracker();
    t.createFunnel('f', ['a']);
    t.createFunnel('f', ['a', 'b', 'c']);
    expect(t.getResult('f', 'u1').totalSteps).toBe(3);
    expect(t.funnelCount()).toBe(1);
  });
});
