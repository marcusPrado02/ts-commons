import type { Option } from '@acme/kernel';

/**
 * Core port for secrets management.
 *
 * All adapters must implement this interface. Methods are async to support
 * remote secret stores (AWS SSM, Vault, etc.) without interface changes.
 */
export interface SecretsPort {
  /**
   * Retrieve a secret by key.
   * Returns `Option.some(value)` when the secret exists, `Option.none()` otherwise.
   */
  get(key: string): Promise<Option<string>>;

  /** Create or overwrite a secret. */
  set(key: string, value: string): Promise<void>;

  /** Delete a secret. No-op if the key does not exist. */
  delete(key: string): Promise<void>;

  /**
   * Trigger secret rotation.
   * Adapters that do not support rotation should throw `SecretsRotationNotSupportedError`.
   */
  rotate(key: string): Promise<void>;
}
