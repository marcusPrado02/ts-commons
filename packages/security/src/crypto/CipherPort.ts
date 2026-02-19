/**
 * Port for symmetric authenticated encryption / decryption.
 */

/** Result of an encryption operation.  All fields are hex-encoded. */
export interface CipherResult {
  /** Encrypted bytes, hex-encoded. */
  readonly ciphertext: string;
  /** Initialisation vector, hex-encoded. */
  readonly iv: string;
  /** GCM authentication tag, hex-encoded. */
  readonly tag: string;
}

/**
 * Symmetric cipher port.
 *
 * @example
 * ```typescript
 * const cipher = new AesGcmCipher();
 * const result = cipher.encrypt('secret', 'my-key');
 * const plaintext = cipher.decrypt(result, 'my-key');
 * ```
 */
export interface CipherPort {
  encrypt(plaintext: string, key: string): CipherResult;
  decrypt(result: CipherResult, key: string): string;
}
