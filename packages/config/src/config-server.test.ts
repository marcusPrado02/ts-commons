/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, vi } from 'vitest';
import { ConfigServer } from './core/ConfigServer';
import { ProfileManager } from './core/ProfileManager';

describe('ConfigServer', () => {
  it('stores and retrieves a value', () => {
    const server = new ConfigServer();
    server.set('db.host', 'localhost');
    expect(server.get('db.host')).toBe('localhost');
  });

  it('returns undefined for unknown key', () => {
    const server = new ConfigServer();
    expect(server.get('unknown')).toBeUndefined();
  });

  it('getAll returns all default-profile keys', () => {
    const server = new ConfigServer();
    server.set('a', 1);
    server.set('b', 2);
    expect(server.getAll()).toEqual({ a: 1, b: 2 });
  });

  it('refresh overwrites an existing key and notifies listeners', () => {
    const server = new ConfigServer();
    server.set('timeout', 3000);
    const listener = vi.fn();
    server.onRefresh(listener);
    server.refresh('timeout', 5000);
    expect(server.get('timeout')).toBe(5000);
    expect(listener).toHaveBeenCalledWith('timeout', 5000);
  });

  it('unsubscribing from refresh stops notifications', () => {
    const server = new ConfigServer();
    const listener = vi.fn();
    const unsub = server.onRefresh(listener);
    unsub();
    server.set('x', 1);
    expect(listener).not.toHaveBeenCalled();
  });

  it('registerProfile allows per-profile overrides', () => {
    const server = new ConfigServer();
    server.set('log.level', 'info');
    server.registerProfile('prod', { 'log.level': 'error' });
    expect(server.get('log.level', 'prod')).toBe('error');
    expect(server.get('log.level')).toBe('info');
  });

  it('getAll with profile merges defaults and profile values', () => {
    const server = new ConfigServer();
    server.set('a', 1);
    server.set('b', 2);
    server.registerProfile('dev', { b: 99, c: 3 });
    const all = server.getAll('dev');
    expect(all).toEqual({ a: 1, b: 99, c: 3 });
  });

  it('encrypt/decrypt round-trips with {cipher} prefix', () => {
    const server = new ConfigServer();
    server.registerEncryption(
      (v) => Buffer.from(v).toString('base64'),
      (v) => Buffer.from(v, 'base64').toString('utf8'),
    );
    const encrypted = server.encrypt('secret');
    expect(encrypted).toMatch(/^\{cipher\}/);
    server.set('pw', encrypted);
    expect(server.get('pw')).toBe('secret');
  });

  it('encrypt throws when no encryptFn registered', () => {
    const server = new ConfigServer();
    expect(() => server.encrypt('x')).toThrow('No encrypt function registered');
  });

  it('springCloudEndpoint returns application + profile + source', () => {
    const server = new ConfigServer();
    server.set('a', 1);
    server.registerProfile('dev', { b: 2 });
    const result = server.springCloudEndpoint('my-app', 'dev');
    expect(result['application']).toBe('my-app');
    expect(result['profile']).toBe('dev');
    expect((result['source'] as Record<string, unknown>)['a']).toBe(1);
    expect((result['source'] as Record<string, unknown>)['b']).toBe(2);
  });

  it('keyCount tracks stored keys', () => {
    const server = new ConfigServer();
    server.set('a', 1);
    server.set('b', 2);
    expect(server.keyCount).toBe(2);
  });
});

describe('ProfileManager', () => {
  it('registers and activates a profile', () => {
    const pm = new ProfileManager();
    pm.register('prod', { debug: false });
    pm.activate('prod');
    expect(pm.current).toBe('prod');
  });

  it('activate throws for unknown profile', () => {
    const pm = new ProfileManager();
    expect(() => pm.activate('ghost')).toThrow('Profile not found: ghost');
  });

  it('get retrieves a value from the active profile', () => {
    const pm = new ProfileManager();
    pm.register('dev', { port: 3000 });
    pm.activate('dev');
    expect(pm.get('port')).toBe(3000);
  });

  it('falls back to default profile when key missing in active', () => {
    const pm = new ProfileManager();
    pm.register('default', { host: 'localhost' });
    pm.register('prod', { port: 80 });
    pm.activate('prod');
    expect(pm.get('host')).toBe('localhost');
  });

  it('getAll merges default and active profiles', () => {
    const pm = new ProfileManager();
    pm.register('default', { a: 1, b: 2 });
    pm.register('prod', { b: 99 });
    pm.activate('prod');
    expect(pm.getAll()).toEqual({ a: 1, b: 99 });
  });

  it('list returns all registered profiles', () => {
    const pm = new ProfileManager();
    pm.register('default', {});
    pm.register('dev', {});
    pm.register('prod', {});
    expect(pm.list()).toEqual(['default', 'dev', 'prod']);
  });

  it('profileCount returns correct count', () => {
    const pm = new ProfileManager();
    pm.register('default', {});
    pm.register('dev', {});
    expect(pm.profileCount).toBe(2);
  });
});
