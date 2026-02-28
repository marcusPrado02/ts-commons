import { createHash, randomBytes } from 'node:crypto';
import type { ApiKeyConfig, ApiKeyRecord } from './types';

/**
 * Generates and manages API key lifecycle (creation, rotation, revocation).
 */
export class ApiKeyManager {
  private readonly keys = new Map<string, ApiKeyRecord>();

  constructor(private readonly config: ApiKeyConfig = {}) {}

  /**
   * Generate a new API key. Returns the raw key (only time it's available) + record.
   */
  generate(
    scopes: string[],
    options?: { expiresAt?: Date; metadata?: Record<string, string> },
  ): { rawKey: string; record: ApiKeyRecord } {
    const byteLen = this.config.byteLength ?? 32;
    const prefix = this.config.prefix ?? 'ak';
    const raw = `${prefix}_${randomBytes(byteLen).toString('hex')}`;
    const keyId = `kid_${randomBytes(8).toString('hex')}`;
    const keyHash = this.hash(raw);
    const record: ApiKeyRecord = {
      keyId,
      keyHash,
      prefix: raw.slice(0, prefix.length + 4),
      scopes: [...scopes],
      createdAt: new Date(),
      ...(options?.expiresAt != null ? { expiresAt: options.expiresAt } : {}),
      ...(options?.metadata != null ? { metadata: options.metadata } : {}),
    };
    this.keys.set(keyId, record);
    return { rawKey: raw, record };
  }

  /**
   * Validate a raw key — checks existence, revocation and expiry. Returns matching record or null.
   */
  validate(rawKey: string): ApiKeyRecord | null {
    const hash = this.hash(rawKey);
    for (const record of this.keys.values()) {
      if (record.keyHash === hash) {
        if (record.revokedAt != null) return null;
        if (record.expiresAt != null && new Date() > record.expiresAt) return null;
        return record;
      }
    }
    return null;
  }

  /**
   * Rotate a key — revokes the old one and generates a new one with the same scopes.
   */
  rotate(keyId: string): { rawKey: string; record: ApiKeyRecord } | null {
    const existing = this.keys.get(keyId);
    if (existing == null) return null;
    this.revoke(keyId);
    const result = this.generate(existing.scopes, {
      ...(existing.expiresAt != null ? { expiresAt: existing.expiresAt } : {}),
      ...(existing.metadata != null ? { metadata: existing.metadata } : {}),
    });
    return result;
  }

  /**
   * Revoke an API key immediately.
   */
  revoke(keyId: string): boolean {
    const record = this.keys.get(keyId);
    if (record == null) return false;
    this.keys.set(keyId, { ...record, revokedAt: new Date() });
    return true;
  }

  /**
   * Look up a record by keyId (without the raw key).
   */
  getRecord(keyId: string): ApiKeyRecord | null {
    return this.keys.get(keyId) ?? null;
  }

  /**
   * Returns all active (non-revoked, non-expired) records.
   */
  listActive(): ApiKeyRecord[] {
    const now = new Date();
    return [...this.keys.values()].filter(
      (r) => r.revokedAt == null && (r.expiresAt == null || r.expiresAt > now),
    );
  }

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
