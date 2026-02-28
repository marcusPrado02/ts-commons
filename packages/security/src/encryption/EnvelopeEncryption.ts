import { randomBytes } from 'node:crypto';
import { FieldEncryption } from './FieldEncryption';
import type { EnvelopedData, EnvelopeOptions } from './types';

/**
 * Envelope encryption: each payload is encrypted with a fresh data key,
 * which is itself encrypted with a master key (KMS-style pattern).
 *
 * The master key is held locally for this implementation;
 * swap in a real KMS by overriding `wrapDataKey` / `unwrapDataKey`.
 */
export class EnvelopeEncryption {
  private readonly masterEncryption: FieldEncryption;

  constructor(
    masterKey: Buffer | string,
    private readonly masterKeyId?: string,
  ) {
    this.masterEncryption = new FieldEncryption(masterKey);
  }

  /** Encrypt a plaintext using a fresh random data key. */
  encrypt(plaintext: string, options?: EnvelopeOptions): EnvelopedData {
    const dataKey = randomBytes(32);
    const dataEncryption = new FieldEncryption(dataKey);

    const encryptedPayload = dataEncryption.encrypt(plaintext).ciphertext;
    const encryptedDataKey = this.masterEncryption.encrypt(dataKey.toString('hex')).ciphertext;
    const keyId = options?.masterKeyId ?? this.masterKeyId;

    return {
      encryptedDataKey,
      encryptedPayload,
      ...(keyId == null ? {} : { masterKeyId: keyId }),
    };
  }

  /** Decrypt an enveloped payload. */
  decrypt(enveloped: EnvelopedData): string {
    const dataKeyHex = this.masterEncryption.decrypt({
      ciphertext: enveloped.encryptedDataKey,
      algorithm: 'aes-256-gcm',
    });
    const dataKey = Buffer.from(dataKeyHex, 'hex');
    const dataEncryption = new FieldEncryption(dataKey);
    return dataEncryption.decrypt({
      ciphertext: enveloped.encryptedPayload,
      algorithm: 'aes-256-gcm',
    });
  }
}
