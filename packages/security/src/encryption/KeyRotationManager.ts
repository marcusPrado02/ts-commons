import { randomBytes } from 'node:crypto';
import { FieldEncryption } from './FieldEncryption';
import type { RotationRecord } from './types';

interface KeyEntry {
  readonly id: string;
  readonly key: Buffer;
  readonly createdAt: Date;
}

/**
 * Manages encryption key rotation.
 * Old keys are kept for decryption; only the active key is used for new encryptions.
 */
export class KeyRotationManager {
  private readonly keys: KeyEntry[] = [];
  private activeKeyId: string;
  private readonly history: RotationRecord[] = [];

  constructor(initialKey?: Buffer) {
    const key = initialKey ?? randomBytes(32);
    const id = `key_${randomBytes(4).toString('hex')}`;
    this.keys.push({ id, key, createdAt: new Date() });
    this.activeKeyId = id;
  }

  /** Get a FieldEncryption instance using the active key. */
  getActiveEncryption(): FieldEncryption {
    const entry = this.keys.find((k) => k.id === this.activeKeyId);
    if (entry == null) throw new Error('No active key');
    return new FieldEncryption(entry.key);
  }

  /** Get a FieldEncryption instance for a specific key ID (for decrypting old data). */
  getEncryptionForKey(keyId: string): FieldEncryption | null {
    const entry = this.keys.find((k) => k.id === keyId);
    if (entry == null) return null;
    return new FieldEncryption(entry.key);
  }

  /** Rotate — generate a new key and make it active. */
  rotate(): RotationRecord {
    const previousKeyId = this.activeKeyId;
    const newKey = randomBytes(32);
    const newId = `key_${randomBytes(4).toString('hex')}`;
    this.keys.push({ id: newId, key: newKey, createdAt: new Date() });
    this.activeKeyId = newId;

    const record: RotationRecord = { keyId: newId, rotatedAt: new Date(), previousKeyId };
    this.history.push(record);
    return record;
  }

  get activeKey(): string {
    return this.activeKeyId;
  }
  get keyCount(): number {
    return this.keys.length;
  }
  getHistory(): readonly RotationRecord[] {
    return [...this.history];
  }
}
