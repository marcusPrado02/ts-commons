/**
 * Port for one-way hashing.
 */
export interface HasherPort {
  /** Return a deterministic hex digest of `data`. */
  hash(data: string): string;
}
