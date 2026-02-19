import { createHash } from 'node:crypto';
import type { HasherPort } from './HasherPort';

/**
 * SHA-256 one-way hasher.
 *
 * Returns a lower-case 64-character hex digest.
 * Use for checksums and non-secret fingerprinting; for passwords prefer
 * a slow KDF (bcrypt / argon2) which is outside the scope of this adapter.
 *
 * @example
 * ```typescript
 * const hasher = new Sha256Hasher();
 * const digest = hasher.hash('hello');
 * // '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
 * ```
 */
export class Sha256Hasher implements HasherPort {
  hash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }
}
