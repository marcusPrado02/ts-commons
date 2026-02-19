/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Result, Option } from '@acme/kernel';
import { Builder } from './builders/Builder';
import { EventEnvelopeFixture } from './fixtures/EventEnvelopeFixture';
import { registerAcmeMatchers } from './matchers/vitestMatchers';
import { PerformanceTimer, measureAsync } from './performance/PerformanceTimer';

// ─── Builder ──────────────────────────────────────────────────────────────────

interface SampleDto {
  name: string;
  age: number;
  role: string;
}

describe('Builder', () => {
  let builder: Builder<SampleDto>;

  beforeEach(() => {
    builder = new Builder<SampleDto>({ name: 'Alice', age: 30, role: 'user' });
  });

  it('build() returns an object matching the defaults', () => {
    const result = builder.build();
    expect(result).toEqual({ name: 'Alice', age: 30, role: 'user' });
  });

  it('with() applies a field override and returns the same builder instance', () => {
    const returned = builder.with('role', 'admin');
    expect(returned).toBe(builder);
    expect(builder.build().role).toBe('admin');
  });

  it('with() calls can be chained to apply multiple overrides', () => {
    const result = builder.with('name', 'Bob').with('age', 25).build();
    expect(result).toEqual({ name: 'Bob', age: 25, role: 'user' });
  });

  it('build(overrides) merges one-off overrides without mutating the builder', () => {
    const first = builder.build({ role: 'guest' });
    const second = builder.build();
    expect(first.role).toBe('guest');
    expect(second.role).toBe('user'); // builder unchanged
  });

  it('buildMany(n) returns an array of n independent copies', () => {
    const items = builder.buildMany(4);
    expect(items).toHaveLength(4);
    expect(items[0]).toEqual(items[3]); // same defaults
  });
});

// ─── EventEnvelopeFixture ─────────────────────────────────────────────────────

describe('EventEnvelopeFixture', () => {
  beforeEach(() => {
    EventEnvelopeFixture.reset();
  });

  it('create() returns an envelope with all required fields populated', () => {
    const env = EventEnvelopeFixture.create();
    expect(env.eventId).toBeDefined();
    expect(env.eventType).toBe('test.event.occurred');
    expect(env.eventVersion).toBe('1.0');
    expect(env.timestamp).toBeDefined();
  });

  it('create(overrides) applies field overrides', () => {
    const env = EventEnvelopeFixture.create({ eventType: 'order.placed', eventVersion: '2.0' });
    expect(env.eventType).toBe('order.placed');
    expect(env.eventVersion).toBe('2.0');
  });

  it('consecutive create() calls generate different eventIds', () => {
    const a = EventEnvelopeFixture.create();
    const b = EventEnvelopeFixture.create();
    expect(a.eventId).not.toBe(b.eventId);
  });

  it('createBatch(n) returns an array of n envelopes each with unique eventIds', () => {
    const batch = EventEnvelopeFixture.createBatch(5);
    expect(batch).toHaveLength(5);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const ids = new Set(batch.map((e) => e.eventId));
    expect(ids.size).toBe(5);
  });
});

// ─── Vitest custom matchers ───────────────────────────────────────────────────

describe('Vitest custom matchers', () => {
  beforeAll(() => {
    registerAcmeMatchers();
  });

  it('toBeOk passes for Result.ok()', () => {
    expect(Result.ok(42)).toBeOk();
  });

  it('toBeOk fails for Result.err() (matcher returns pass=false)', () => {
    expect(() => expect(Result.err(new Error('x'))).toBeOk()).toThrow();
  });

  it('toBeErr passes for Result.err()', () => {
    expect(Result.err(new Error('boom'))).toBeErr();
  });

  it('toBeSome passes for Option.some()', () => {
    expect(Option.some('hello')).toBeSome();
  });

  it('toBeNone passes for Option.none()', () => {
    expect(Option.none()).toBeNone();
  });
});

// ─── PerformanceTimer ─────────────────────────────────────────────────────────

describe('PerformanceTimer', () => {
  it('start() creates a timer where elapsed() returns a non-negative number', () => {
    const timer = PerformanceTimer.start();
    expect(timer.elapsed()).toBeGreaterThanOrEqual(0);
  });

  it('assertUnder() does not throw when the budget has not been exceeded', () => {
    const timer = PerformanceTimer.start();
    expect(() => timer.assertUnder(10_000)).not.toThrow();
  });

  it('assertUnder() throws when the budget is already exceeded (budget = -1 ms)', () => {
    const timer = PerformanceTimer.start();
    expect(() => timer.assertUnder(-1, 'test-label')).toThrow(/Performance budget exceeded/);
  });

  it('reset() restarts the timer so elapsed() is close to zero again', () => {
    const timer = PerformanceTimer.start();
    timer.reset();
    expect(timer.elapsed()).toBeGreaterThanOrEqual(0);
    expect(timer.elapsed()).toBeLessThan(50); // should complete well within 50 ms
  });

  it('measureAsync() returns the result and a non-negative elapsedMs', async () => {
    const { result, elapsedMs } = await measureAsync(async () => Promise.resolve(99));
    expect(result).toBe(99);
    expect(elapsedMs).toBeGreaterThanOrEqual(0);
  });
});
