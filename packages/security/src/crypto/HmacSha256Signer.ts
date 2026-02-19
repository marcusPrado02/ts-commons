import { createHmac, timingSafeEqual } from 'node:crypto';
import type { HmacPort } from './HmacPort';

/**
 * HMAC-SHA256 signer / verifier.
 *
 * - `sign` returns a deterministic 64-char hex digest.
 * - `verify` uses a constant-time comparison (`timingSafeEqual`) to
 *   prevent timing-based side-channel attacks.
 *
 * @example
 * ```typescript
 * const signer = new HmacSha256Signer();
 * const sig = signer.sign('payload', process.env.HMAC_KEY!);
 * signer.verify('payload', process.env.HMAC_KEY!, sig); // true
 * ```
 */
export class HmacSha256Signer implements HmacPort {
  sign(data: string, key: string): string {
    return createHmac('sha256', key).update(data).digest('hex');
  }

  verify(data: string, key: string, signature: string): boolean {
    const expected = this.sign(data, key);
    // Both must be equal length for timingSafeEqual; hex is always same length
    // when the algorithm is the same.
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
