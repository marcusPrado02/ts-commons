/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Vitest mock objects require any-typed assignments */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- Vitest mock arguments */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Vitest mock property access */
/* eslint-disable @typescript-eslint/no-unsafe-call -- Vitest mock call patterns */
/* eslint-disable @typescript-eslint/unbound-method -- Vitest mocking pattern requires unbound methods */
/* eslint-disable @typescript-eslint/explicit-function-return-type -- test helper functions */
/* eslint-disable max-lines-per-function -- test files naturally have longer functions */
/**
 * Tests for @acme/secrets
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Option, Duration } from '@acme/kernel';
import { EnvSecretsAdapter } from './EnvSecretsAdapter';
import { CachedSecretsAdapter } from './CachedSecretsAdapter';
import { FallbackSecretsAdapter } from './FallbackSecretsAdapter';
import { AwsSsmSecretsAdapter } from './AwsSsmSecretsAdapter';
import { SecretsRotationNotSupportedError } from './SecretsErrors';
import type { SecretsPort } from './SecretsPort';
import type { AwsSsmClientLike } from './AwsSsmClientLike';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSsmClient(): AwsSsmClientLike {
  return {
    getParameter:    vi.fn(),
    putParameter:    vi.fn().mockResolvedValue({}),
    deleteParameter: vi.fn().mockResolvedValue({}),
  } as unknown as AwsSsmClientLike;
}

function buildInnerAdapter(): SecretsPort {
  return {
    get:    vi.fn(),
    set:    vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    rotate: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// EnvSecretsAdapter
// ---------------------------------------------------------------------------

describe('EnvSecretsAdapter', () => {
  const adapter = new EnvSecretsAdapter();
  const TEST_KEY = '__ACME_TEST_SECRET__';

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete process.env[TEST_KEY];
  });

  it('get() should return Option.some when the env var exists', async () => {
    process.env[TEST_KEY] = 'super-secret';

    const result = await adapter.get(TEST_KEY);

    expect(result.isSome()).toBe(true);
    expect(result.unwrap()).toBe('super-secret');
  });

  it('get() should return Option.none when the env var is absent', async () => {
    const result = await adapter.get(TEST_KEY);

    expect(result.isNone()).toBe(true);
  });

  it('set() should write a value to process.env', async () => {
    await adapter.set(TEST_KEY, 'new-value');

    expect(process.env[TEST_KEY]).toBe('new-value');
  });

  it('delete() should remove the env var', async () => {
    process.env[TEST_KEY] = 'to-be-deleted';

    await adapter.delete(TEST_KEY);

    expect(process.env[TEST_KEY]).toBeUndefined();
  });

  it('rotate() should throw SecretsRotationNotSupportedError', async () => {
    await expect(adapter.rotate(TEST_KEY)).rejects.toBeInstanceOf(SecretsRotationNotSupportedError);
  });
});

// ---------------------------------------------------------------------------
// CachedSecretsAdapter
// ---------------------------------------------------------------------------

describe('CachedSecretsAdapter', () => {
  let inner: SecretsPort;
  let adapter: CachedSecretsAdapter;

  beforeEach(() => {
    inner   = buildInnerAdapter();
    adapter = new CachedSecretsAdapter(inner, Duration.ofMinutes(5));
  });

  it('get() should delegate to inner on cache miss', async () => {
    vi.mocked(inner.get).mockResolvedValue(Option.some('secret-value'));

    const result = await adapter.get('db-password');

    expect(inner.get).toHaveBeenCalledWith('db-password');
    expect(result.isSome()).toBe(true);
    expect(result.unwrap()).toBe('secret-value');
  });

  it('get() should return cached value and not call inner again', async () => {
    vi.mocked(inner.get).mockResolvedValue(Option.some('cached'));

    await adapter.get('api-key');
    const second = await adapter.get('api-key');

    expect(inner.get).toHaveBeenCalledTimes(1);
    expect(second.unwrap()).toBe('cached');
  });

  it('set() should delegate to inner and populate the cache', async () => {
    await adapter.set('api-key', 'xyz');

    // subsequent get should NOT call inner (already cached)
    const result = await adapter.get('api-key');

    expect(inner.set).toHaveBeenCalledWith('api-key', 'xyz');
    expect(inner.get).not.toHaveBeenCalled();
    expect(result.unwrap()).toBe('xyz');
  });

  it('delete() should delegate to inner and evict from cache', async () => {
    vi.mocked(inner.get).mockResolvedValue(Option.some('value'));
    await adapter.get('token');          // prime the cache
    await adapter.delete('token');

    vi.mocked(inner.get).mockResolvedValue(Option.none());
    await adapter.get('token');          // must hit inner again

    expect(inner.delete).toHaveBeenCalledWith('token');
    expect(inner.get).toHaveBeenCalledTimes(2);
  });

  it('rotate() should delegate to inner and evict from cache', async () => {
    await adapter.rotate('db-password');

    expect(inner.rotate).toHaveBeenCalledWith('db-password');
  });
});

// ---------------------------------------------------------------------------
// FallbackSecretsAdapter
// ---------------------------------------------------------------------------

describe('FallbackSecretsAdapter', () => {
  it('get() should return the first adapter value when found', async () => {
    const primary   = buildInnerAdapter();
    const secondary = buildInnerAdapter();
    vi.mocked(primary.get).mockResolvedValue(Option.some('primary-val'));

    const adapter = new FallbackSecretsAdapter([primary, secondary]);
    const result  = await adapter.get('key');

    expect(result.unwrap()).toBe('primary-val');
    expect(secondary.get).not.toHaveBeenCalled();
  });

  it('get() should fall through to second adapter when first returns none', async () => {
    const primary   = buildInnerAdapter();
    const secondary = buildInnerAdapter();
    vi.mocked(primary.get).mockResolvedValue(Option.none());
    vi.mocked(secondary.get).mockResolvedValue(Option.some('fallback-val'));

    const adapter = new FallbackSecretsAdapter([primary, secondary]);
    const result  = await adapter.get('key');

    expect(result.unwrap()).toBe('fallback-val');
  });

  it('get() should return Option.none when all adapters miss', async () => {
    const a = buildInnerAdapter();
    const b = buildInnerAdapter();
    vi.mocked(a.get).mockResolvedValue(Option.none());
    vi.mocked(b.get).mockResolvedValue(Option.none());

    const adapter = new FallbackSecretsAdapter([a, b]);
    const result  = await adapter.get('missing');

    expect(result.isNone()).toBe(true);
  });

  it('set() should delegate to all adapters', async () => {
    const a = buildInnerAdapter();
    const b = buildInnerAdapter();

    const adapter = new FallbackSecretsAdapter([a, b]);
    await adapter.set('key', 'value');

    expect(a.set).toHaveBeenCalledWith('key', 'value');
    expect(b.set).toHaveBeenCalledWith('key', 'value');
  });

  it('delete() should delegate to all adapters', async () => {
    const a = buildInnerAdapter();
    const b = buildInnerAdapter();

    const adapter = new FallbackSecretsAdapter([a, b]);
    await adapter.delete('key');

    expect(a.delete).toHaveBeenCalledWith('key');
    expect(b.delete).toHaveBeenCalledWith('key');
  });
});

// ---------------------------------------------------------------------------
// AwsSsmSecretsAdapter
// ---------------------------------------------------------------------------

describe('AwsSsmSecretsAdapter', () => {
  let client: AwsSsmClientLike;
  let adapter: AwsSsmSecretsAdapter;

  beforeEach(() => {
    client  = buildSsmClient();
    adapter = new AwsSsmSecretsAdapter(client, '/myapp/prod');
  });

  it('get() should return Option.some when parameter is found', async () => {
    vi.mocked(client.getParameter).mockResolvedValue({
      Parameter: { Value: 'db-secret-xyz' },
    });

    const result = await adapter.get('DB_PASSWORD');

    expect(client.getParameter).toHaveBeenCalledWith({
      Name:           '/myapp/prod/DB_PASSWORD',
      WithDecryption: true,
    });
    expect(result.unwrap()).toBe('db-secret-xyz');
  });

  it('get() should return Option.none when ParameterNotFound is thrown', async () => {
    const err  = new Error('Parameter not found');
    err.name   = 'ParameterNotFound';
    vi.mocked(client.getParameter).mockRejectedValue(err);

    const result = await adapter.get('MISSING_KEY');

    expect(result.isNone()).toBe(true);
  });

  it('set() should call putParameter with SecureString and Overwrite', async () => {
    await adapter.set('API_KEY', 'tok-123');

    expect(client.putParameter).toHaveBeenCalledWith({
      Name:      '/myapp/prod/API_KEY',
      Value:     'tok-123',
      Type:      'SecureString',
      Overwrite: true,
    });
  });

  it('delete() should call deleteParameter with full path', async () => {
    await adapter.delete('API_KEY');

    expect(client.deleteParameter).toHaveBeenCalledWith({
      Name: '/myapp/prod/API_KEY',
    });
  });
});
