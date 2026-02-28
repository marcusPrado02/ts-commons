import type { KmsKeyConfig } from './types';

type EncryptFn = (plaintext: string, keyId: string) => Promise<string>;
type DecryptFn = (ciphertext: string, keyId: string) => Promise<string>;

/**
 * Pluggable KMS adapter.
 * Implement `encrypt` and `decrypt` for your chosen provider (AWS KMS, Azure Key Vault, GCP KMS).
 */
export interface KmsAdapter {
  encrypt(plaintext: string, keyId: string): Promise<string>;
  decrypt(ciphertext: string, keyId: string): Promise<string>;
}

/**
 * KMS client that delegates encryption/decryption to a provider adapter.
 * Supports AWS, Azure and GCP through pluggable adapters.
 */
export class KmsClient {
  constructor(
    private readonly config: KmsKeyConfig,
    private readonly adapter: KmsAdapter,
  ) {}

  get provider(): string {
    return this.config.provider;
  }
  get keyId(): string {
    return this.config.keyId;
  }

  async encrypt(plaintext: string): Promise<string> {
    return this.adapter.encrypt(plaintext, this.config.keyId);
  }

  async decrypt(ciphertext: string): Promise<string> {
    return this.adapter.decrypt(ciphertext, this.config.keyId);
  }

  /** Create a KmsClient from a provider name and factory functions (for testing/DI). */
  static fromFunctions(
    config: KmsKeyConfig,
    encryptFn: EncryptFn,
    decryptFn: DecryptFn,
  ): KmsClient {
    return new KmsClient(config, { encrypt: encryptFn, decrypt: decryptFn });
  }
}
