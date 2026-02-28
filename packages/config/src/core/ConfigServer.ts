/* eslint-disable @typescript-eslint/require-await */

export type CompatibilityMode = 'NONE' | 'BACKWARD' | 'FORWARD' | 'FULL';

export interface ProfileConfig {
  name: string;
  values: Record<string, unknown>;
}

/**
 * A centralized in-process configuration server supporting:
 * - Named profiles (dev / staging / prod / …)
 * - Dynamic refresh (re-register values at runtime)
 * - Spring Cloud Config compatible key lookup
 * - Basic encryption (register an encrypt/decrypt pair)
 */
export class ConfigServer {
  private readonly store = new Map<string, unknown>();
  private readonly profileStore = new Map<string, Map<string, unknown>>();
  private encryptFn: ((value: string) => string) | undefined;
  private decryptFn: ((value: string) => string) | undefined;
  private readonly refreshListeners: Array<(key: string, value: unknown) => void> = [];

  /** Register (or overwrite) a key-value in the default profile. */
  set(key: string, value: unknown): void {
    this.store.set(key, value);
    for (const listener of this.refreshListeners) {
      listener(key, value);
    }
  }

  /**
   * Get a value from the active profile, falling back to the default store.
   * Encrypted values (prefixed with `{cipher}`) are decrypted automatically
   * when a `decryptFn` is registered.
   */
  get<T = unknown>(key: string, profile?: string): T | undefined {
    let value: unknown;
    if (profile !== undefined) {
      value = this.profileStore.get(profile)?.get(key);
    }
    if (value === undefined) {
      value = this.store.get(key);
    }

    if (typeof value === 'string' && value.startsWith('{cipher}') && this.decryptFn) {
      value = this.decryptFn(value.slice(8));
    }

    return value as T | undefined;
  }

  /** Return all keys (default profile). */
  getAll(profile?: string): Record<string, unknown> {
    const base = Object.fromEntries(this.store);
    if (profile === undefined) return base;
    const overrides = Object.fromEntries(this.profileStore.get(profile) ?? []);
    return { ...base, ...overrides };
  }

  /** Dynamically refresh a key. Alias for `set` — notifies listeners. */
  refresh(key: string, value: unknown): void {
    this.set(key, value);
  }

  /** Register a profile with its own set of values. */
  registerProfile(name: string, values: Record<string, unknown>): void {
    const map = new Map<string, unknown>(Object.entries(values));
    this.profileStore.set(name, map);
  }

  /** Register encrypt / decrypt functions used for `{cipher}` values. */
  registerEncryption(
    encryptFn: (value: string) => string,
    decryptFn: (value: string) => string,
  ): void {
    this.encryptFn = encryptFn;
    this.decryptFn = decryptFn;
  }

  /** Encrypt a plaintext string and return `{cipher}<encrypted>`. */
  encrypt(value: string): string {
    if (!this.encryptFn) throw new Error('No encrypt function registered');
    return `{cipher}${this.encryptFn(value)}`;
  }

  /** Subscribe to key refresh events. Returns an unsubscribe function. */
  onRefresh(listener: (key: string, value: unknown) => void): () => void {
    this.refreshListeners.push(listener);
    return () => {
      const idx = this.refreshListeners.indexOf(listener);
      if (idx !== -1) this.refreshListeners.splice(idx, 1);
    };
  }

  /** Spring Cloud Config compatible: GET /<application>/<profile>/<label> */
  springCloudEndpoint(application: string, profile: string): Record<string, unknown> {
    const base = this.getAll();
    const profileValues = Object.fromEntries(this.profileStore.get(profile) ?? []);
    return { application, profile, source: { ...base, ...profileValues } };
  }

  get keyCount(): number {
    return this.store.size;
  }
}
