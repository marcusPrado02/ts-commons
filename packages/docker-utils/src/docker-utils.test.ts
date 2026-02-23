/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/only-throw-error */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GracefulShutdown } from './GracefulShutdown';
import { HealthAggregator } from './HealthAggregator';
import { HealthCheckHandler } from './HealthCheckHandler';
import { readDockerContext } from './DockerContext';
import type { HealthCheck } from './types';

// ── GracefulShutdown ──────────────────────────────────────────────────────────

describe('GracefulShutdown', () => {
  let gs: GracefulShutdown;

  beforeEach(() => {
    gs = new GracefulShutdown(5_000);
  });

  it('isShuttingDown() starts false', () => {
    expect(gs.isShuttingDown()).toBe(false);
  });

  it('handlerCount() starts at 0', () => {
    expect(gs.handlerCount()).toBe(0);
  });

  it('register() increments handlerCount', () => {
    gs.register('db', async () => {});
    expect(gs.handlerCount()).toBe(1);
  });

  it('names() returns registered names', () => {
    gs.register('db', async () => {});
    gs.register('cache', async () => {});
    expect(gs.names()).toEqual(['db', 'cache']);
  });

  it('shutdown() sets isShuttingDown to true', async () => {
    await gs.shutdown();
    expect(gs.isShuttingDown()).toBe(true);
  });

  it('shutdown() calls a registered handler', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    gs.register('db', fn);
    await gs.shutdown();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('shutdown() calls handlers in reverse registration order', async () => {
    const order: string[] = [];
    gs.register('first', async () => {
      order.push('first');
    });
    gs.register('second', async () => {
      order.push('second');
    });
    gs.register('third', async () => {
      order.push('third');
    });
    await gs.shutdown();
    expect(order).toEqual(['third', 'second', 'first']);
  });

  it('shutdown() returns success:true when all handlers succeed', async () => {
    gs.register('ok', async () => {});
    const result = await gs.shutdown();
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('shutdown() returns success:false when a handler throws', async () => {
    gs.register('bad', async () => {
      throw new Error('db gone');
    });
    const result = await gs.shutdown();
    expect(result.success).toBe(false);
  });

  it('shutdown() records thrown Error message', async () => {
    gs.register('bad', async () => {
      throw new Error('detail error');
    });
    const result = await gs.shutdown();
    expect(result.errors[0]).toContain('detail error');
  });

  it('shutdown() records non-Error throws as string', async () => {
    gs.register('bad', async () => {
      throw 'string reason';
    });
    const result = await gs.shutdown();
    expect(result.errors[0]).toBe('string reason');
  });

  it('shutdown() called twice returns early on second call', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    gs.register('db', fn);
    await gs.shutdown();
    await gs.shutdown();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('shutdown() with no handlers succeeds', async () => {
    const result = await gs.shutdown();
    expect(result.success).toBe(true);
  });

  it('registers multiple handlers and calls all of them', async () => {
    const calls: string[] = [];
    gs.register('a', async () => {
      calls.push('a');
    });
    gs.register('b', async () => {
      calls.push('b');
    });
    gs.register('c', async () => {
      calls.push('c');
    });
    await gs.shutdown();
    expect(calls).toHaveLength(3);
  });

  it('one failing handler does not prevent remaining handlers from running', async () => {
    const calls: string[] = [];
    gs.register('first', async () => {
      calls.push('first');
    });
    gs.register('bad', async () => {
      throw new Error('fail');
    });
    gs.register('last', async () => {
      calls.push('last');
    });
    await gs.shutdown();
    expect(calls).toContain('first');
    expect(calls).toContain('last');
  });
});

// ── HealthAggregator ──────────────────────────────────────────────────────────

describe('HealthAggregator', () => {
  let agg: HealthAggregator;

  const okCheck = async (): Promise<HealthCheck> => ({
    name: 'test',
    status: 'ok',
    message: undefined,
    latencyMs: undefined,
  });

  const downCheck = async (): Promise<HealthCheck> => ({
    name: 'test',
    status: 'down',
    message: 'gone',
    latencyMs: undefined,
  });

  const degradedCheck = async (): Promise<HealthCheck> => ({
    name: 'test',
    status: 'degraded',
    message: 'slow',
    latencyMs: undefined,
  });

  beforeEach(() => {
    agg = new HealthAggregator('1.2.3');
  });

  it('count() starts at 0', () => {
    expect(agg.count()).toBe(0);
  });

  it('register() increments count', () => {
    agg.register('db', okCheck);
    expect(agg.count()).toBe(1);
  });

  it('names() returns registered check names', () => {
    agg.register('db', okCheck);
    agg.register('cache', okCheck);
    expect(agg.names()).toEqual(['db', 'cache']);
  });

  it('overallStatus() all ok → ok', () => {
    const checks: HealthCheck[] = [
      { name: 'a', status: 'ok', message: undefined, latencyMs: 1 },
      { name: 'b', status: 'ok', message: undefined, latencyMs: 2 },
    ];
    expect(agg.overallStatus(checks)).toBe('ok');
  });

  it('overallStatus() one degraded → degraded', () => {
    const checks: HealthCheck[] = [
      { name: 'a', status: 'ok', message: undefined, latencyMs: 1 },
      { name: 'b', status: 'degraded', message: 'slow', latencyMs: 999 },
    ];
    expect(agg.overallStatus(checks)).toBe('degraded');
  });

  it('overallStatus() one down → down', () => {
    const checks: HealthCheck[] = [
      { name: 'a', status: 'ok', message: undefined, latencyMs: 1 },
      { name: 'b', status: 'down', message: 'gone', latencyMs: undefined },
    ];
    expect(agg.overallStatus(checks)).toBe('down');
  });

  it('overallStatus() down beats degraded → down', () => {
    const checks: HealthCheck[] = [
      { name: 'a', status: 'degraded', message: 'slow', latencyMs: 800 },
      { name: 'b', status: 'down', message: 'gone', latencyMs: undefined },
    ];
    expect(agg.overallStatus(checks)).toBe('down');
  });

  it('overallStatus() empty array → ok', () => {
    expect(agg.overallStatus([])).toBe('ok');
  });

  it('aggregate() returns a timestamp', async () => {
    const report = await agg.aggregate();
    expect(report.timestamp).toBeTruthy();
  });

  it('aggregate() returns the version set in constructor', async () => {
    const report = await agg.aggregate();
    expect(report.version).toBe('1.2.3');
  });

  it('aggregate() version is undefined when not provided', async () => {
    const noVer = new HealthAggregator();
    const report = await noVer.aggregate();
    expect(report.version).toBeUndefined();
  });

  it('aggregate() calls the registered check function', async () => {
    const fn = vi.fn().mockResolvedValue(okCheck());
    agg.register('db', fn);
    await agg.aggregate();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('aggregate() result check name matches the registered name', async () => {
    agg.register('myService', okCheck);
    const report = await agg.aggregate();
    expect(report.checks[0]?.name).toBe('myService');
  });

  it('aggregate() handles a failing check gracefully', async () => {
    agg.register('bad', async () => {
      throw new Error('conn refused');
    });
    const report = await agg.aggregate();
    expect(report.checks[0]?.status).toBe('down');
    expect(report.checks[0]?.message).toContain('conn refused');
  });

  it('aggregate() overall reflects check statuses', async () => {
    agg.register('ok', okCheck);
    agg.register('down', downCheck);
    const report = await agg.aggregate();
    expect(report.overall).toBe('down');
  });

  it('aggregate() overall is degraded when only degraded checks', async () => {
    agg.register('slow', degradedCheck);
    const report = await agg.aggregate();
    expect(report.overall).toBe('degraded');
  });

  it('aggregate() includes all registered checks in result', async () => {
    agg.register('a', okCheck);
    agg.register('b', okCheck);
    agg.register('c', okCheck);
    const report = await agg.aggregate();
    expect(report.checks).toHaveLength(3);
  });
});

// ── HealthCheckHandler ────────────────────────────────────────────────────────

describe('HealthCheckHandler', () => {
  let handler: HealthCheckHandler;
  let agg: HealthAggregator;

  const okCheck = async (): Promise<HealthCheck> => ({
    name: 'db',
    status: 'ok',
    message: undefined,
    latencyMs: 5,
  });

  const downCheck = async (): Promise<HealthCheck> => ({
    name: 'db',
    status: 'down',
    message: 'gone',
    latencyMs: undefined,
  });

  beforeEach(() => {
    agg = new HealthAggregator('2.0.0');
    handler = new HealthCheckHandler(agg);
  });

  it('handleLiveness() returns status 200', async () => {
    const res = await handler.handleLiveness();
    expect(res.statusCode).toBe(200);
  });

  it('handleLiveness() body has status ok', async () => {
    const res = await handler.handleLiveness();
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
  });

  it('handleLiveness() content-type is application/json', async () => {
    const res = await handler.handleLiveness();
    expect(res.contentType).toBe('application/json');
  });

  it('handleLiveness() body has timestamp', async () => {
    const res = await handler.handleLiveness();
    const body = JSON.parse(res.body);
    expect(body.timestamp).toBeTruthy();
  });

  it('handleReadiness() with ok checks returns 200', async () => {
    agg.register('db', okCheck);
    const res = await handler.handleReadiness();
    expect(res.statusCode).toBe(200);
  });

  it('handleReadiness() with down check returns 503', async () => {
    agg.register('db', downCheck);
    const res = await handler.handleReadiness();
    expect(res.statusCode).toBe(503);
  });

  it('handleReadiness() body includes checks array', async () => {
    agg.register('db', okCheck);
    const res = await handler.handleReadiness();
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.checks)).toBe(true);
  });

  it('handleReadiness() body has overall field', async () => {
    agg.register('db', okCheck);
    const res = await handler.handleReadiness();
    const body = JSON.parse(res.body);
    expect(body.overall).toBeTruthy();
  });

  it('handleRequest("/health/live") → liveness', async () => {
    const res = await handler.handleRequest('/health/live');
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
  });

  it('handleRequest("/healthz") → liveness', async () => {
    const res = await handler.handleRequest('/healthz');
    expect(res.statusCode).toBe(200);
  });

  it('handleRequest("/health/ready") → readiness', async () => {
    agg.register('db', okCheck);
    const res = await handler.handleRequest('/health/ready');
    const body = JSON.parse(res.body);
    expect(body.overall).toBe('ok');
  });

  it('handleRequest("/readyz") → readiness', async () => {
    agg.register('db', okCheck);
    const res = await handler.handleRequest('/readyz');
    expect(res.statusCode).toBe(200);
  });

  it('handleRequest("/unknown") → 404', async () => {
    const res = await handler.handleRequest('/unknown');
    expect(res.statusCode).toBe(404);
  });

  it('handleRequest("/unknown") content-type is text/plain', async () => {
    const res = await handler.handleRequest('/unknown');
    expect(res.contentType).toBe('text/plain');
  });
});

// ── readDockerContext ─────────────────────────────────────────────────────────

describe('readDockerContext', () => {
  it('hostname comes from HOSTNAME env var', () => {
    const ctx = readDockerContext({ HOSTNAME: 'my-pod-abc' });
    expect(ctx.hostname).toBe('my-pod-abc');
  });

  it('hostname falls back to os.hostname() when HOSTNAME not set', () => {
    const ctx = readDockerContext({});
    expect(ctx.hostname).toBeTruthy();
  });

  it('nodeEnv comes from NODE_ENV env var', () => {
    const ctx = readDockerContext({ NODE_ENV: 'production' });
    expect(ctx.nodeEnv).toBe('production');
  });

  it('nodeEnv defaults to development when not set', () => {
    const ctx = readDockerContext({});
    expect(ctx.nodeEnv).toBe('development');
  });

  it('isContainer is false when no container markers in env', () => {
    const ctx = readDockerContext({ HOSTNAME: 'localhost' });
    expect(ctx.isContainer).toBe(false);
  });

  it('isContainer is true when KUBERNETES_SERVICE_HOST is set', () => {
    const ctx = readDockerContext({ KUBERNETES_SERVICE_HOST: '10.0.0.1' });
    expect(ctx.isContainer).toBe(true);
  });

  it('isContainer is true when DOCKER_CONTAINER=true', () => {
    const ctx = readDockerContext({ DOCKER_CONTAINER: 'true' });
    expect(ctx.isContainer).toBe(true);
  });

  it('isContainer is false when DOCKER_CONTAINER has other value', () => {
    const ctx = readDockerContext({ DOCKER_CONTAINER: 'yes' });
    expect(ctx.isContainer).toBe(false);
  });

  it('imageTag comes from IMAGE_TAG env var', () => {
    const ctx = readDockerContext({ IMAGE_TAG: 'v1.2.3' });
    expect(ctx.imageTag).toBe('v1.2.3');
  });

  it('imageTag is undefined when not set', () => {
    const ctx = readDockerContext({});
    expect(ctx.imageTag).toBeUndefined();
  });

  it('buildDate comes from BUILD_DATE env var', () => {
    const ctx = readDockerContext({ BUILD_DATE: '2026-02-23' });
    expect(ctx.buildDate).toBe('2026-02-23');
  });

  it('gitCommit comes from GIT_COMMIT env var', () => {
    const ctx = readDockerContext({ GIT_COMMIT: 'abc1234' });
    expect(ctx.gitCommit).toBe('abc1234');
  });

  it('returns all undefined optional fields when env is empty', () => {
    const ctx = readDockerContext({});
    expect(ctx.imageTag).toBeUndefined();
    expect(ctx.buildDate).toBeUndefined();
    expect(ctx.gitCommit).toBeUndefined();
  });
});
