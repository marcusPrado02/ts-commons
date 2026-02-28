/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, beforeEach } from 'vitest';
import { ApiKeyManager } from './ApiKeyManager';
import { ApiKeyUsageTracker } from './ApiKeyUsageTracker';

// ──────────────────────────────────────────────────────────────────────────────
// ApiKeyManager
// ──────────────────────────────────────────────────────────────────────────────

describe('ApiKeyManager', () => {
  let mgr: ApiKeyManager;

  beforeEach(() => {
    mgr = new ApiKeyManager({ prefix: 'sk' });
  });

  it('generates a key with correct prefix', () => {
    const { rawKey } = mgr.generate(['read']);
    expect(rawKey.startsWith('sk_')).toBe(true);
  });

  it('generates unique keys on each call', () => {
    const a = mgr.generate(['read']);
    const b = mgr.generate(['read']);
    expect(a.rawKey).not.toBe(b.rawKey);
    expect(a.record.keyId).not.toBe(b.record.keyId);
  });

  it('stores record with correct scopes', () => {
    const { record } = mgr.generate(['read', 'write']);
    expect(record.scopes).toEqual(['read', 'write']);
  });

  it('validates a generated key', () => {
    const { rawKey } = mgr.generate(['read']);
    expect(mgr.validate(rawKey)).not.toBeNull();
  });

  it('validate returns null for unknown key', () => {
    expect(mgr.validate('sk_nonexistent')).toBeNull();
  });

  it('revokes a key so validate returns null', () => {
    const { rawKey, record } = mgr.generate(['read']);
    mgr.revoke(record.keyId);
    expect(mgr.validate(rawKey)).toBeNull();
  });

  it('revoke returns false for unknown keyId', () => {
    expect(mgr.revoke('unknown')).toBe(false);
  });

  it('rejects expired key', () => {
    const past = new Date(Date.now() - 1000);
    const { rawKey } = mgr.generate(['read'], { expiresAt: past });
    expect(mgr.validate(rawKey)).toBeNull();
  });

  it('accepts key with future expiry', () => {
    const future = new Date(Date.now() + 60_000);
    const { rawKey } = mgr.generate(['read'], { expiresAt: future });
    expect(mgr.validate(rawKey)).not.toBeNull();
  });

  it('rotate revokes old key and returns new key', () => {
    const { rawKey: old, record } = mgr.generate(['read', 'write']);
    const rotated = mgr.rotate(record.keyId);
    expect(rotated).not.toBeNull();
    expect(mgr.validate(old)).toBeNull(); // old revoked
    expect(mgr.validate(rotated!.rawKey)).not.toBeNull(); // new valid
  });

  it('rotate returns null for unknown keyId', () => {
    expect(mgr.rotate('unknown')).toBeNull();
  });

  it('listActive excludes revoked keys', () => {
    const { record } = mgr.generate(['read']);
    mgr.revoke(record.keyId);
    expect(mgr.listActive().find((r) => r.keyId === record.keyId)).toBeUndefined();
  });

  it('listActive includes active keys', () => {
    const { record } = mgr.generate(['read']);
    expect(mgr.listActive().find((r) => r.keyId === record.keyId)).toBeDefined();
  });

  it('getRecord returns record by id', () => {
    const { record } = mgr.generate(['read']);
    expect(mgr.getRecord(record.keyId)?.keyId).toBe(record.keyId);
  });

  it('getRecord returns null for unknown id', () => {
    expect(mgr.getRecord('unknown')).toBeNull();
  });

  it('generated record has no keyHash exposed in raw form', () => {
    const { rawKey, record } = mgr.generate(['read']);
    expect(record.keyHash).not.toBe(rawKey);
    expect(record.keyHash.length).toBe(64); // sha256 hex
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ApiKeyUsageTracker
// ──────────────────────────────────────────────────────────────────────────────

describe('ApiKeyUsageTracker', () => {
  it('records usage events', () => {
    const tracker = new ApiKeyUsageTracker();
    tracker.record({
      keyId: 'k1',
      timestamp: new Date(),
      endpoint: '/api/v1/data',
      statusCode: 200,
    });
    tracker.record({
      keyId: 'k1',
      timestamp: new Date(),
      endpoint: '/api/v1/data',
      statusCode: 200,
    });
    expect(tracker.getStats('k1').requestCount).toBe(2);
  });

  it('getStats returns lastUsedAt', () => {
    const tracker = new ApiKeyUsageTracker();
    const ts = new Date();
    tracker.record({ keyId: 'k1', timestamp: ts });
    expect(tracker.getStats('k1').lastUsedAt).toEqual(ts);
  });

  it('getStats returns 0 requests for unknown key', () => {
    const tracker = new ApiKeyUsageTracker();
    expect(tracker.getStats('unknown').requestCount).toBe(0);
  });

  it('isRateLimited returns false when no config', () => {
    const tracker = new ApiKeyUsageTracker();
    expect(tracker.isRateLimited('k1')).toBe(false);
  });

  it('rate limits after max requests in window', () => {
    const tracker = new ApiKeyUsageTracker({ maxRequests: 3, windowMs: 5000 });
    tracker.incrementRateCounter('k1');
    tracker.incrementRateCounter('k1');
    tracker.incrementRateCounter('k1');
    expect(tracker.isRateLimited('k1')).toBe(true);
  });

  it('is not rate limited before reaching max', () => {
    const tracker = new ApiKeyUsageTracker({ maxRequests: 5, windowMs: 5000 });
    tracker.incrementRateCounter('k1');
    tracker.incrementRateCounter('k1');
    expect(tracker.isRateLimited('k1')).toBe(false);
  });

  it('getRecords filters by since date', () => {
    const tracker = new ApiKeyUsageTracker();
    const old = new Date(Date.now() - 10_000);
    const recent = new Date();
    tracker.record({ keyId: 'k1', timestamp: old });
    tracker.record({ keyId: 'k1', timestamp: recent });
    const results = tracker.getRecords('k1', new Date(Date.now() - 5_000));
    expect(results.length).toBe(1);
  });

  it('clear removes usage and rate data', () => {
    const tracker = new ApiKeyUsageTracker({ maxRequests: 2, windowMs: 5000 });
    tracker.record({ keyId: 'k1', timestamp: new Date() });
    tracker.incrementRateCounter('k1');
    tracker.incrementRateCounter('k1');
    tracker.clear('k1');
    expect(tracker.getStats('k1').requestCount).toBe(0);
    expect(tracker.isRateLimited('k1')).toBe(false);
  });
});
