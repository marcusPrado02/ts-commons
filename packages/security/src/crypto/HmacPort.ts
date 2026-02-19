/**
 * Port for HMAC signing and verification.
 */
export interface HmacPort {
  /** Produce a hex-encoded HMAC signature of `data` with `key`. */
  sign(data: string, key: string): string;
  /** Return `true` iff `signature` is the valid HMAC of `data` under `key`. */
  verify(data: string, key: string, signature: string): boolean;
}
