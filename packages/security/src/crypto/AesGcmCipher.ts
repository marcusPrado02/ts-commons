import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { CipherPort, CipherResult } from './CipherPort';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES   = 12;  // 96-bit IV — recommended for GCM
const TAG_BYTES  = 16;  // 128-bit auth tag

/**
 * Derives a 32-byte AES-256 key from an arbitrary string using SHA-256.
 * This lets callers pass human-readable key strings.
 */
function deriveKey(key: string): Buffer {
  return createHash('sha256').update(key).digest();
}

/**
 * AES-256-GCM symmetric cipher.
 *
 * - Generates a fresh random 96-bit IV on every `encrypt` call.
 * - The GCM authentication tag detects ciphertext or key tampering at
 *   `decrypt` time (throws on mismatch).
 * - The caller's key string is normalised to 256 bits via SHA-256 so any
 *   string length is accepted.
 *
 * @example
 * ```typescript
 * const cipher = new AesGcmCipher();
 * const result = cipher.encrypt('my secret', process.env.ENCRYPTION_KEY!);
 * const plain  = cipher.decrypt(result,  process.env.ENCRYPTION_KEY!);
 * ```
 */
export class AesGcmCipher implements CipherPort {
  encrypt(plaintext: string, key: string): CipherResult {
    const iv     = randomBytes(IV_BYTES);
    const k      = deriveKey(key);
    const cipher = createCipheriv(ALGORITHM, k, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('hex'),
      iv:         iv.toString('hex'),
      tag:        tag.toString('hex'),
    };
  }

  decrypt(result: CipherResult, key: string): string {
    const k          = deriveKey(key);
    const iv         = Buffer.from(result.iv, 'hex');
    const tag        = Buffer.from(result.tag, 'hex');
    const ciphertext = Buffer.from(result.ciphertext, 'hex');

    const decipher = createDecipheriv(ALGORITHM, k, iv);
    decipher.setAuthTag(tag);
    // If the key or tag is wrong, `final()` will throw.
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }
}

export { TAG_BYTES };
