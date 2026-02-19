/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Vitest mock objects */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- Vitest mock arguments */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Vitest mock property access */
/* eslint-disable @typescript-eslint/no-unsafe-call -- Vitest mock call patterns */
/* eslint-disable @typescript-eslint/unbound-method -- Vitest mocking pattern */
/* eslint-disable @typescript-eslint/no-unnecessary-condition -- noUncheckedIndexedAccess makes optional chaining necessary on array access */
/* eslint-disable @typescript-eslint/explicit-function-return-type -- test helper functions */
/* eslint-disable max-lines-per-function -- test files naturally have longer functions */
/**
 * Tests for @acme/observability — Structured logging (Item 21)
 *
 * LevelFilterLogger · SamplingLogger · PerformanceLogger · PiiRedactor
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogLevel } from './logging/LogLevel';
import { LevelFilterLogger } from './logging/LevelFilterLogger';
import { SamplingLogger } from './logging/SamplingLogger';
import { PerformanceLogger } from './logging/PerformanceLogger';
import { PiiRedactor } from './logging/PiiRedactor';
import type { LoggerPort } from '@acme/kernel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMockLogger(): LoggerPort {
  return {
    debug: vi.fn(),
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// LevelFilterLogger
// ---------------------------------------------------------------------------

describe('LevelFilterLogger', () => {
  let inner:  LoggerPort;

  beforeEach(() => { inner = buildMockLogger(); });

  it('suppresses debug messages when minLevel is INFO', () => {
    const logger = new LevelFilterLogger(inner, LogLevel.INFO);

    logger.debug('should be ignored');

    expect(inner.debug).not.toHaveBeenCalled();
  });

  it('forwards info messages when minLevel is INFO', () => {
    const logger = new LevelFilterLogger(inner, LogLevel.INFO);

    logger.info('visible');

    expect(inner.info).toHaveBeenCalledWith('visible', undefined);
  });

  it('forwards warn messages when minLevel is INFO', () => {
    const logger = new LevelFilterLogger(inner, LogLevel.INFO);

    logger.warn('visible warn');

    expect(inner.warn).toHaveBeenCalledOnce();
  });

  it('always forwards error messages regardless of minLevel', () => {
    const logger = new LevelFilterLogger(inner, LogLevel.ERROR);
    const err    = new Error('critical');

    logger.error('critical failure', err);

    expect(inner.error).toHaveBeenCalledWith('critical failure', err, undefined);
  });

  it('suppresses warn when minLevel is raised to ERROR', () => {
    const logger = new LevelFilterLogger(inner, LogLevel.INFO);
    logger.setMinLevel(LogLevel.ERROR);

    logger.warn('now suppressed');

    expect(inner.warn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// SamplingLogger
// ---------------------------------------------------------------------------

describe('SamplingLogger', () => {
  let inner: LoggerPort;

  beforeEach(() => { inner = buildMockLogger(); });

  it('forwards every info call when sampleRate is 1.0', () => {
    const logger = new SamplingLogger(inner, 1.0, () => 0.0); // 0.0 < 1.0 → always log

    logger.info('msg1');
    logger.info('msg2');

    expect(inner.info).toHaveBeenCalledTimes(2);
  });

  it('drops all info calls when sampleRate is 0.0', () => {
    const logger = new SamplingLogger(inner, 0.0, () => 0.5); // 0.5 < 0.0 is false → never log

    logger.info('dropped');

    expect(inner.info).not.toHaveBeenCalled();
  });

  it('always forwards error calls even at sampleRate 0.0', () => {
    const logger = new SamplingLogger(inner, 0.0, () => 0.5);

    logger.error('critical', new Error('boom'));

    expect(inner.error).toHaveBeenCalledOnce();
  });

  it('forwards warn when random value is below sampleRate', () => {
    const logger = new SamplingLogger(inner, 0.9, () => 0.5); // 0.5 < 0.9 → log

    logger.warn('sampled warn');

    expect(inner.warn).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// PerformanceLogger
// ---------------------------------------------------------------------------

describe('PerformanceLogger', () => {
  let inner: LoggerPort;
  let perf:  PerformanceLogger;

  beforeEach(() => {
    inner = buildMockLogger();
    perf  = new PerformanceLogger(inner);
  });

  it('resolves and returns the result of the wrapped async function', async () => {
    const result = await perf.measure('fetchUser', () => Promise.resolve('user-42'));

    expect(result).toBe('user-42');
  });

  it('calls logger.info after a successful operation', async () => {
    await perf.measure('processOrder', () => Promise.resolve());

    expect(inner.info).toHaveBeenCalledOnce();
  });

  it('log message includes the operation name on success', async () => {
    await perf.measure('sendEmail', () => Promise.resolve());

    const call = vi.mocked(inner.info).mock.calls[0];
    expect(call?.[0]).toContain('sendEmail');
  });

  it('log context contains a non-negative durationMs on success', async () => {
    await perf.measure('quickOp', () => Promise.resolve());

    const ctx = vi.mocked(inner.info).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(typeof ctx?.['durationMs']).toBe('number');
    expect(ctx?.['durationMs'] as number).toBeGreaterThanOrEqual(0);
  });

  it('calls logger.error and rethrows when the wrapped function rejects', async () => {
    const boom = new Error('db timeout');

    await expect(
      perf.measure('dbQuery', () => { throw boom; }),
    ).rejects.toThrow('db timeout');

    expect(inner.error).toHaveBeenCalledOnce();
    expect(vi.mocked(inner.error).mock.calls[0]?.[0]).toContain('dbQuery');
  });
});

// ---------------------------------------------------------------------------
// PiiRedactor
// ---------------------------------------------------------------------------

describe('PiiRedactor', () => {
  it("redacts the 'password' field", () => {
    const result = PiiRedactor.redact({ password: 's3cr3t', name: 'Alice' });

    expect(result['password']).toBe('[REDACTED]');
  });

  it("redacts the 'email' field", () => {
    const result = PiiRedactor.redact({ email: 'alice@example.com' });

    expect(result['email']).toBe('[REDACTED]');
  });

  it('leaves non-PII fields intact', () => {
    const result = PiiRedactor.redact({ orderId: 'ord-1', amount: 99 });

    expect(result['orderId']).toBe('ord-1');
    expect(result['amount']).toBe(99);
  });

  it('recursively redacts nested objects', () => {
    const result = PiiRedactor.redact({ user: { ssn: '123-45-6789', age: 30 } });

    const user = result['user'] as Record<string, unknown>;
    expect(user['ssn']).toBe('[REDACTED]');
    expect(user['age']).toBe(30);
  });

  it('redacts multiple PII fields in a single object', () => {
    const result = PiiRedactor.redact({
      password: 'pwd', email: 'e@x.com', creditCard: '4111', name: 'Bob',
    });

    expect(result['password']).toBe('[REDACTED]');
    expect(result['email']).toBe('[REDACTED]');
    expect(result['creditCard']).toBe('[REDACTED]');
    expect(result['name']).toBe('Bob');
  });
});
