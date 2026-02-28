export interface ApiKeyConfig {
  /** Prefix for generated keys, e.g. 'sk' → 'sk_live_xxxx' */
  readonly prefix?: string;
  /** Length of the random portion in bytes (default: 32) */
  readonly byteLength?: number;
}

export interface ApiKeyRecord {
  readonly keyId: string;
  readonly keyHash: string; // SHA-256 of the raw key (never store raw)
  readonly prefix: string; // First few chars for lookups
  readonly scopes: string[];
  readonly createdAt: Date;
  readonly expiresAt?: Date;
  readonly rotatedAt?: Date;
  readonly revokedAt?: Date;
  readonly metadata?: Record<string, string>;
}

export interface ApiKeyUsageRecord {
  readonly keyId: string;
  readonly timestamp: Date;
  readonly endpoint?: string;
  readonly statusCode?: number;
  readonly durationMs?: number;
}

export interface RateLimitConfig {
  /** Max requests per window */
  readonly maxRequests: number;
  /** Window size in milliseconds */
  readonly windowMs: number;
}

export interface ApiKeyStats {
  readonly keyId: string;
  readonly requestCount: number;
  readonly lastUsedAt?: Date;
  readonly rateLimited: boolean;
}
