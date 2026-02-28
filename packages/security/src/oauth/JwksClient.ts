import type { JwksDocument, JwksKey } from './types';

type FetchFn = (url: string) => Promise<Response>;

/**
 * JWKS (JSON Web Key Set) client — fetches and caches public keys for JWT verification.
 */
export class JwksClient {
  private readonly cache: Map<string, JwksKey> = new Map();
  private lastFetch = 0;
  private readonly cacheTtlMs: number;

  constructor(
    private readonly jwksUri: string,
    private readonly fetch: FetchFn,
    options?: { cacheTtlMs?: number },
  ) {
    this.cacheTtlMs = options?.cacheTtlMs ?? 3600_000; // 1 hour default
  }

  /**
   * Fetch the JWKS and cache it. Returns all keys.
   */
  async getKeys(forceRefresh = false): Promise<JwksKey[]> {
    if (forceRefresh || this.isCacheStale()) {
      await this.refresh();
    }
    return Array.from(this.cache.values());
  }

  /**
   * Find a specific key by kid.
   */
  async getKey(kid: string): Promise<JwksKey | null> {
    let key = this.cache.get(kid);
    if (!key) {
      // Try re-fetching once (kid may be newly rotated)
      await this.refresh();
      key = this.cache.get(kid);
    }
    return key ?? null;
  }

  /**
   * Find keys by use (e.g. 'sig' for signing).
   */
  async getKeysByUse(use: string): Promise<JwksKey[]> {
    const keys = await this.getKeys();
    return keys.filter((k) => k.use === use);
  }

  private isCacheStale(): boolean {
    return Date.now() - this.lastFetch > this.cacheTtlMs;
  }

  private async refresh(): Promise<void> {
    const response = await this.fetch(this.jwksUri);
    if (!response.ok) {
      throw new Error(`JWKS fetch failed: ${response.status} ${response.statusText}`);
    }
    const doc = (await response.json()) as JwksDocument;
    this.cache.clear();
    for (const key of doc.keys) {
      const keyId = key.kid ?? key.kty;
      this.cache.set(keyId, key);
    }
    this.lastFetch = Date.now();
  }

  clearCache(): void {
    this.cache.clear();
    this.lastFetch = 0;
  }

  cacheSize(): number {
    return this.cache.size;
  }
}
