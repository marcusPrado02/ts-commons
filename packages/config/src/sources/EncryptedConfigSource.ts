import type { ConfigSource } from './ConfigSource';

/**
 * A function that decrypts a single ciphertext value.
 * In production use AES-GCM or similar. For tests a simple reverse suffices.
 */
export type DecryptFn = (ciphertext: string) => string;

/**
 * Wraps any {@link ConfigSource} and transparently decrypts specific keys
 * before they reach the schema validator.
 *
 * ```ts
 * const source = new EncryptedConfigSource(
 *   new ProcessEnvSource(),
 *   ciphertext => myKms.decrypt(ciphertext),
 *   new Set(['DB_PASSWORD', 'API_SECRET']),
 * );
 * const loader = new ConfigLoader(schema, [source]);
 * ```
 */
export class EncryptedConfigSource implements ConfigSource {
  constructor(
    private readonly inner: ConfigSource,
    private readonly decrypt: DecryptFn,
    private readonly encryptedKeys: ReadonlySet<string>,
  ) {}

  async load(): Promise<Record<string, string | undefined>> {
    const raw = await this.inner.load();
    const out: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (this.encryptedKeys.has(key) && value !== undefined) {
        out[key] = this.decrypt(value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }
}
