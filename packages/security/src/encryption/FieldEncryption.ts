import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import type { EncryptedValue } from './types';

const ALG = 'aes-256-gcm';
const IV_SIZE = 12;
const TAG_SIZE = 16;
const KEY_SIZE = 32;

/**
 * AES-256-GCM encryption for individual fields / at-rest data.
 *
 * The serialized format is: base64([iv (12)] + [authTag (16)] + [ciphertext])
 */
export class FieldEncryption {
  private readonly keyBuffer: Buffer;

  /**
   * @param key  A 32-byte Buffer, or a passphrase string (derived via scrypt)
   * @param salt Salt used when key is a passphrase string (ignored for Buffer keys)
   */
  constructor(key: Buffer | string, salt?: string) {
    if (Buffer.isBuffer(key)) {
      if (key.length !== KEY_SIZE) throw new Error(`Key must be ${KEY_SIZE} bytes`);
      this.keyBuffer = key;
    } else {
      const s = salt ?? 'default-salt-change-me';
      this.keyBuffer = scryptSync(key, s, KEY_SIZE) as Buffer;
    }
  }

  /** Encrypt a plaintext string. Returns an EncryptedValue. */
  encrypt(plaintext: string): EncryptedValue {
    const iv = randomBytes(IV_SIZE);
    const cipher = createCipheriv(ALG, this.keyBuffer, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, tag, encrypted]);
    return { ciphertext: combined.toString('base64'), algorithm: ALG };
  }

  /** Decrypt an EncryptedValue. Returns the original plaintext. */
  decrypt(value: EncryptedValue): string {
    const combined = Buffer.from(value.ciphertext, 'base64');
    const iv = combined.subarray(0, IV_SIZE);
    const tag = combined.subarray(IV_SIZE, IV_SIZE + TAG_SIZE);
    const ciphertext = combined.subarray(IV_SIZE + TAG_SIZE);

    const decipher = createDecipheriv(ALG, this.keyBuffer, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
  }

  /** Encrypt a structured object (JSON-serialised). */
  encryptObject(obj: unknown): EncryptedValue {
    return this.encrypt(JSON.stringify(obj));
  }

  /** Decrypt and parse a JSON-encrypted object. */
  decryptObject<T>(value: EncryptedValue): T {
    return JSON.parse(this.decrypt(value)) as T;
  }
}
