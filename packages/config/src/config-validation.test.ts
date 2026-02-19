/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { ConfigSource } from './sources/ConfigSource';
import { ZodConfigSchema } from './core/ZodConfigSchema';
import { HotReloadConfigLoader } from './core/HotReloadConfigLoader';
import { ConfigLoader } from './core/ConfigLoader';
import { InMemoryRemoteConfigSource } from './sources/RemoteConfigSource';
import { EncryptedConfigSource } from './sources/EncryptedConfigSource';

// ---------------------------------------------------------------------------
// Suite 1: ZodConfigSchema
// ---------------------------------------------------------------------------

describe('ZodConfigSchema', () => {
  const schema = new ZodConfigSchema(
    z.object({
      HOST: z.string().min(1),
      PORT: z.coerce.number().int().min(1),
    }),
  );

  it('returns Ok when all required keys are present and valid', () => {
    const result = schema.validate({ HOST: 'localhost', PORT: '3000' });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ HOST: 'localhost', PORT: 3000 });
  });

  it('returns Err with descriptive messages when keys are missing', () => {
    const result = schema.validate({});
    expect(result.isErr()).toBe(true);
    const errors = result.unwrapErr();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/HOST|PORT/);
  });

  it('returns Err when a value fails coercion or constraint', () => {
    const result = schema.validate({ HOST: 'localhost', PORT: 'not-a-number' });
    expect(result.isErr()).toBe(true);
    const errors = result.unwrapErr();
    expect(errors.some((e: string) => e.includes('PORT'))).toBe(true);
  });

  it('includes the field path in each error message', () => {
    const nested = new ZodConfigSchema(
      z.object({ db: z.object({ host: z.string() }) }),
    );
    const result = nested.validate({ db: '' });
    expect(result.isErr()).toBe(true);
  });

  it('integrates with ConfigLoader end-to-end', async () => {
    const source: ConfigSource = {
      load: (): Promise<Record<string, string | undefined>> =>
        Promise.resolve({ HOST: 'example.com', PORT: '8080' }),
    };
    const loader = new ConfigLoader(schema, [source]);
    const config = await loader.load();
    expect(config).toEqual({ HOST: 'example.com', PORT: 8080 });
  });
});

// ---------------------------------------------------------------------------
// Suite 2: HotReloadConfigLoader
// ---------------------------------------------------------------------------

describe('HotReloadConfigLoader', () => {
  function makeLoader(value: Record<string, string | undefined>): ConfigLoader<Record<string, string | undefined>> {
    const schema = new ZodConfigSchema(z.record(z.string()));
    const source: ConfigSource = {
      load: (): Promise<Record<string, string | undefined>> => Promise.resolve(value),
    };
    return new ConfigLoader(schema, [source]);
  }

  it('start() loads and stores configuration', async () => {
    const hot = new HotReloadConfigLoader(makeLoader({ KEY: 'val' }));
    const cfg = await hot.start();
    expect(cfg).toEqual({ KEY: 'val' });
    expect(hot.get()).toEqual({ KEY: 'val' });
  });

  it('get() throws before start() is called', () => {
    const hot = new HotReloadConfigLoader(makeLoader({}));
    expect(() => hot.get()).toThrow();
  });

  it('reload() re-loads and notifies listeners', async () => {
    let v = 'first';
    const schema = new ZodConfigSchema(z.record(z.string()));
    const source: ConfigSource = {
      load: (): Promise<Record<string, string | undefined>> => Promise.resolve({ VALUE: v }),
    };
    const loader = new ConfigLoader(schema, [source]);
    const hot = new HotReloadConfigLoader(loader);
    await hot.start();

    const spy = vi.fn();
    hot.onChange(spy);
    v = 'second';
    await hot.reload();

    expect(hot.get()).toEqual({ VALUE: 'second' });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith({ VALUE: 'second' });
  });

  it('unsubscribe returned by onChange stops notifications', async () => {
    const schema = new ZodConfigSchema(z.record(z.string()));
    const source: ConfigSource = {
      load: (): Promise<Record<string, string | undefined>> => Promise.resolve({ X: '1' }),
    };
    const hot = new HotReloadConfigLoader(new ConfigLoader(schema, [source]));
    await hot.start();
    const spy = vi.fn();
    const unsub = hot.onChange(spy);
    unsub();
    await hot.reload();
    expect(spy).not.toHaveBeenCalled();
  });

  it('multiple listeners are all notified', async () => {
    const hot = new HotReloadConfigLoader(makeLoader({ A: '1' }));
    await hot.start();
    const spy1 = vi.fn();
    const spy2 = vi.fn();
    hot.onChange(spy1);
    hot.onChange(spy2);
    await hot.reload();
    expect(spy1).toHaveBeenCalledOnce();
    expect(spy2).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Suite 3: InMemoryRemoteConfigSource
// ---------------------------------------------------------------------------

describe('InMemoryRemoteConfigSource', () => {
  it('load() returns the initial values', async () => {
    const src = new InMemoryRemoteConfigSource({ API: 'key' });
    expect(await src.load()).toEqual({ API: 'key' });
  });

  it('set() makes new values available on next load()', async () => {
    const src = new InMemoryRemoteConfigSource();
    src.set('NEW', 'value');
    expect(await src.load()).toEqual({ NEW: 'value' });
  });

  it('delete() removes a key', async () => {
    const src = new InMemoryRemoteConfigSource({ GONE: 'bye' });
    src.delete('GONE');
    expect((await src.load())['GONE']).toBeUndefined();
  });

  it('refresh() resolves without error', async () => {
    const src = new InMemoryRemoteConfigSource();
    await expect(src.refresh()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Suite 4: EncryptedConfigSource
// ---------------------------------------------------------------------------

describe('EncryptedConfigSource', () => {
  /** Toy decryption: reverses the string. */
  const decrypt = (s: string): string => s.split('').reverse().join('');

  const inner: ConfigSource = {
    load: (): Promise<Record<string, string | undefined>> =>
      Promise.resolve({
        HOST: 'localhost',
        SECRET: 'terces',   // reversed "secret"
        TOKEN: 'nekot',     // reversed "token"
      }),
  };

  const src = new EncryptedConfigSource(inner, decrypt, new Set(['SECRET', 'TOKEN']));

  it('decrypts only the specified keys', async () => {
    const raw = await src.load();
    expect(raw['SECRET']).toBe('secret');
    expect(raw['TOKEN']).toBe('token');
  });

  it('leaves non-encrypted keys unchanged', async () => {
    const raw = await src.load();
    expect(raw['HOST']).toBe('localhost');
  });

  it('preserves undefined values without calling decrypt', async () => {
    const withUndef: ConfigSource = {
      load: (): Promise<Record<string, string | undefined>> =>
        Promise.resolve({ SECRET: undefined }),
    };
    const s = new EncryptedConfigSource(withUndef, decrypt, new Set(['SECRET']));
    const raw = await s.load();
    expect(raw['SECRET']).toBeUndefined();
  });

  it('works end-to-end inside ConfigLoader', async () => {
    const schema = new ZodConfigSchema(
      z.object({ HOST: z.string(), SECRET: z.string(), TOKEN: z.string() }),
    );
    const loader = new ConfigLoader(schema, [src]);
    const config = await loader.load();
    expect(config.SECRET).toBe('secret');
    expect(config.TOKEN).toBe('token');
    expect(config.HOST).toBe('localhost');
  });

  it('a key not in encryptedKeys is not decrypted even if it looks encrypted', async () => {
    const weirdSrc: ConfigSource = {
      load: (): Promise<Record<string, string | undefined>> =>
        Promise.resolve({ HOST: 'tsohlacol', PLAIN: 'hello' }),
    };
    const s = new EncryptedConfigSource(weirdSrc, decrypt, new Set(['HOST']));
    const raw = await s.load();
    // HOST should be decrypted → 'localhost'; PLAIN should remain 'hello'
    expect(raw['HOST']).toBe('localhost');
    expect(raw['PLAIN']).toBe('hello');
  });
});
