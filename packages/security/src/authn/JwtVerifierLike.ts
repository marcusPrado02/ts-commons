import type { JwtClaims } from './JwtClaims';

/**
 * Structural interface for JWT token verification.
 *
 * Cast your JWT library's verifier (e.g. `jsonwebtoken`) to `JwtVerifierLike`
 * to avoid a hard dependency inside this library.
 *
 * @example
 * ```typescript
 * import jwt from 'jsonwebtoken';
 * import type { JwtVerifierLike } from '@acme/security';
 *
 * const authenticator = new JwtAuthenticator(
 *   jwt as unknown as JwtVerifierLike,
 *   process.env.JWT_SECRET ?? '',
 * );
 * ```
 *
 * The `verify` method is synchronous (matching `jsonwebtoken.verify` with no callback).
 * It **throws** on failure — adapters wrap the call in a try/catch.
 *
 * Recognised thrown error names:
 * - `'TokenExpiredError'` → mapped to `ExpiredTokenError`
 * - anything else → mapped to `InvalidTokenError`
 */
export interface JwtVerifierLike {
  verify(token: string, secret: string): JwtClaims;
}
