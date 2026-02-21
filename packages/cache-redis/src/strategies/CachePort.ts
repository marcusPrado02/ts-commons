import type { Option } from '@acme/kernel';
import type { Duration } from '@acme/kernel';

/**
 * Generic cache port (hexagonal architecture interface).
 *
 * All implementations (in-memory L1, Redis L2, multi-level, …) satisfy this
 * contract, enabling dependency-inversion at the application layer.
 */
export interface CachePort {
  get<T>(key: string): Promise<Option<T>>;
  set<T>(key: string, value: T, ttl?: Duration): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
}
