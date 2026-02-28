export interface EncryptedValue {
  /** Base64-encoded: [iv (12 bytes)][authTag (16 bytes)][ciphertext] */
  readonly ciphertext: string;
  /** Algorithm identifier */
  readonly algorithm: 'aes-256-gcm';
}

export interface EnvelopeOptions {
  /** Key ID used to encrypt the data key (for rotation tracking) */
  readonly masterKeyId?: string;
}

export interface EnvelopedData {
  readonly encryptedDataKey: string; // base64 — data key encrypted with master key
  readonly encryptedPayload: string; // base64 — payload encrypted with data key
  readonly masterKeyId?: string;
}

export type KmsProvider = 'aws' | 'azure' | 'gcp';

export interface KmsKeyConfig {
  readonly provider: KmsProvider;
  /** Provider-specific key identifier (ARN, Key URI, etc.) */
  readonly keyId: string;
}

export interface RotationRecord {
  readonly keyId: string;
  readonly rotatedAt: Date;
  readonly previousKeyId?: string;
}
