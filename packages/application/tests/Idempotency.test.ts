/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Result } from '@acme/kernel';
import {
  IdempotencyKey,
  InMemoryIdempotencyStore,
  IdempotencyMetrics,
  IdempotentUseCase,
  IdempotencyConflictError,
} from '../src';
import type { WithIdempotencyKey } from '../src';
import type { UseCase } from '../src/usecases/UseCase';

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface SimpleInput extends WithIdempotencyKey {
  readonly payload: string;
}

const makeInput = (keyStr: string, payload = 'data'): SimpleInput => ({
  idempotencyKey: IdempotencyKey.create(keyStr),
  payload,
});

// ─── InMemoryIdempotencyStore ─────────────────────────────────────────────────

describe('InMemoryIdempotencyStore', () => {
  let store: InMemoryIdempotencyStore<string>;

  beforeEach(() => {
    store = new InMemoryIdempotencyStore<string>();
  });

  it('tryAcquire returns true for a new key', async () => {
    const key = IdempotencyKey.create('key-1');
    const acquired = await store.tryAcquire(key, 60_000);
    expect(acquired).toBe(true);
  });

  it('tryAcquire returns false for an already-held key', async () => {
    const key = IdempotencyKey.create('key-2');
    await store.tryAcquire(key, 60_000);
    const second = await store.tryAcquire(key, 60_000);
    expect(second).toBe(false);
  });

  it('getResult returns null before storeResult is called', async () => {
    const key = IdempotencyKey.create('key-3');
    await store.tryAcquire(key, 60_000);
    const result = await store.getResult(key);
    expect(result).toBeNull();
  });

  it('getResult returns the stored result after storeResult', async () => {
    const key = IdempotencyKey.create('key-4');
    await store.tryAcquire(key, 60_000);
    await store.storeResult(key, 'my-result', 60_000);
    const result = await store.getResult(key);
    expect(result).toBe('my-result');
  });

  it('release removes the key allowing re-acquire', async () => {
    const key = IdempotencyKey.create('key-5');
    await store.tryAcquire(key, 60_000);
    await store.release(key);
    const reacquired = await store.tryAcquire(key, 60_000);
    expect(reacquired).toBe(true);
  });

  it('cleanup removes expired entries and returns count', async () => {
    const key1 = IdempotencyKey.create('exp-1');
    const key2 = IdempotencyKey.create('exp-2');
    const key3 = IdempotencyKey.create('live-1');

    // Expired immediately (ttl = -1 ms relative → expired before cleanup runs)
    await store.tryAcquire(key1, 0);
    await store.tryAcquire(key2, 0);
    // Alive
    await store.tryAcquire(key3, 60_000);

    // Small delay to ensure ttl=0 entries are past their expiresAt
    await new Promise<void>(r => setTimeout(r, 5));

    const removed = store.cleanup();
    expect(removed).toBe(2);
    expect(store.size()).toBe(1);
  });

  it('size tracks the number of currently held entries', async () => {
    const k1 = IdempotencyKey.create('s-1');
    const k2 = IdempotencyKey.create('s-2');
    expect(store.size()).toBe(0);
    await store.tryAcquire(k1, 60_000);
    expect(store.size()).toBe(1);
    await store.tryAcquire(k2, 60_000);
    expect(store.size()).toBe(2);
    await store.release(k1);
    expect(store.size()).toBe(1);
  });
});

// ─── IdempotencyMetrics ───────────────────────────────────────────────────────

describe('IdempotencyMetrics', () => {
  let metrics: IdempotencyMetrics;

  beforeEach(() => {
    metrics = new IdempotencyMetrics();
  });

  it('starts with all counters at zero', () => {
    expect(metrics.hits).toBe(0);
    expect(metrics.misses).toBe(0);
    expect(metrics.conflicts).toBe(0);
    expect(metrics.errors).toBe(0);
  });

  it('recordHit increments only the hits counter', () => {
    metrics.recordHit();
    metrics.recordHit();
    expect(metrics.hits).toBe(2);
    expect(metrics.misses).toBe(0);
  });

  it('recordMiss and recordConflict increment independently', () => {
    metrics.recordMiss();
    metrics.recordConflict();
    metrics.recordConflict();
    expect(metrics.misses).toBe(1);
    expect(metrics.conflicts).toBe(2);
    expect(metrics.hits).toBe(0);
  });

  it('snapshot returns a point-in-time copy of all counters', () => {
    metrics.recordHit();
    metrics.recordMiss();
    metrics.recordError();
    const snap = metrics.snapshot();
    expect(snap).toEqual({ hits: 1, misses: 1, conflicts: 0, errors: 1 });
  });

  it('reset zeroes all counters', () => {
    metrics.recordHit();
    metrics.recordMiss();
    metrics.recordConflict();
    metrics.recordError();
    metrics.reset();
    expect(metrics.snapshot()).toEqual({ hits: 0, misses: 0, conflicts: 0, errors: 0 });
  });
});

// ─── IdempotentUseCase ────────────────────────────────────────────────────────

describe('IdempotentUseCase', () => {
  let store: InMemoryIdempotencyStore<Result<string>>;
  let metrics: IdempotencyMetrics;
  let mockExecute: ReturnType<typeof vi.fn>;
  let inner: UseCase<SimpleInput, string>;
  let useCase: IdempotentUseCase<SimpleInput, string>;

  beforeEach(() => {
    store = new InMemoryIdempotencyStore<Result<string>>();
    metrics = new IdempotencyMetrics();
    mockExecute = vi.fn();
    inner = { execute: mockExecute };
    useCase = new IdempotentUseCase(inner, store, 60_000, metrics);
  });

  it('executes inner use case and returns its Result on first call', async () => {
    mockExecute.mockResolvedValueOnce(Result.ok('output'));
    const input = makeInput('uc-1');
    const result = await useCase.execute(input);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe('output');
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('returns cached result on second call with same key (never calls inner again)', async () => {
    mockExecute.mockResolvedValue(Result.ok('first'));
    const input = makeInput('uc-2');
    await useCase.execute(input);
    const second = await useCase.execute(input);
    expect(second.unwrap()).toBe('first');
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('records miss metric on first execution', async () => {
    mockExecute.mockResolvedValue(Result.ok('x'));
    await useCase.execute(makeInput('uc-3'));
    expect(metrics.misses).toBe(1);
    expect(metrics.hits).toBe(0);
  });

  it('records hit metric on repeated request with same key', async () => {
    mockExecute.mockResolvedValue(Result.ok('y'));
    const input = makeInput('uc-4');
    await useCase.execute(input);
    await useCase.execute(input);
    await useCase.execute(input);
    expect(metrics.hits).toBe(2);
    expect(metrics.misses).toBe(1);
  });

  it('throws IdempotencyConflictError when lock is held but result not yet stored', async () => {
    const key = IdempotencyKey.create('uc-5');
    // Simulate another worker holding the lock (acquired, result=null)
    await store.tryAcquire(key, 60_000);

    const input: SimpleInput = { idempotencyKey: key, payload: 'concurrent' };
    await expect(useCase.execute(input)).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(metrics.conflicts).toBe(1);
  });

  it('releases lock when inner use case throws, allowing a subsequent retry', async () => {
    mockExecute
      .mockRejectedValueOnce(new Error('infra-error'))
      .mockResolvedValueOnce(Result.ok('retry-ok'));

    const input = makeInput('uc-6');

    await expect(useCase.execute(input)).rejects.toThrow('infra-error');

    // Lock released → retry should succeed
    const retryResult = await useCase.execute(input);
    expect(retryResult.unwrap()).toBe('retry-ok');
  });

  it('records error metric when inner use case throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('boom'));
    await expect(useCase.execute(makeInput('uc-7'))).rejects.toThrow('boom');
    expect(metrics.errors).toBe(1);
    expect(metrics.misses).toBe(1);
  });
});
