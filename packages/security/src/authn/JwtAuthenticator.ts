/* eslint-disable
   @typescript-eslint/no-unsafe-return,
   @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/strict-boolean-expressions
   -- Result is from @acme/kernel; all types are correct at compile time but
   unresolvable by the ESLint TS plugin due to TypeScript 5.9.x / plugin <5.4.
   JwtClaims index-signature fields are unknown[], narrowed via typeof/Array.isArray. */
import { Result } from '@acme/kernel';
import type { AuthenticatedPrincipal } from './AuthenticatedPrincipal';
import type { AuthenticatorPort } from './AuthenticatorPort';
import type { AuthError } from './AuthErrors';
import { InvalidTokenError, ExpiredTokenError } from './AuthErrors';
import type { JwtVerifierLike } from './JwtVerifierLike';

/**
 * JWT authentication adapter.
 *
 * Uses structural `JwtVerifierLike` — no direct dependency on `jsonwebtoken`.
 *
 * Claim mapping:
 * - `sub`         → `principal.id`
 * - `tenantId`    → `principal.tenantId` (optional)
 * - `roles`       → `principal.roles` (array of strings)
 * - `permissions` → `principal.permissions` (array of strings)
 *
 * Throws mapping:
 * - `{ name: 'TokenExpiredError' }` → `ExpiredTokenError`
 * - anything else                   → `InvalidTokenError`
 *
 * @example
 * ```typescript
 * import jwt from 'jsonwebtoken';
 * import { JwtAuthenticator } from '@acme/security';
 *
 * const auth = new JwtAuthenticator(
 *   jwt as unknown as JwtVerifierLike,
 *   process.env.JWT_SECRET ?? '',
 * );
 * const result = await auth.authenticate(request.headers.authorization ?? '');
 * ```
 */
export class JwtAuthenticator implements AuthenticatorPort {
  constructor(
    private readonly verifier: JwtVerifierLike,
    private readonly secret: string,
  ) {}

  authenticate(token: string): Promise<Result<AuthenticatedPrincipal, AuthError>> {
    const raw = token.startsWith('Bearer ') ? token.slice(7) : token;
    try {
      const claims = this.verifier.verify(raw, this.secret);

      const rolesRaw       = claims['roles'];
      const permissionsRaw = claims['permissions'];
      const tenantIdRaw    = claims['tenantId'];

      const roles:       string[] = Array.isArray(rolesRaw)       ? (rolesRaw as string[])       : [];
      const permissions: string[] = Array.isArray(permissionsRaw) ? (permissionsRaw as string[]) : [];

      const principal: AuthenticatedPrincipal = typeof tenantIdRaw === 'string'
        ? { id: claims.sub, tenantId: tenantIdRaw, roles, permissions }
        : { id: claims.sub, roles, permissions };

      return Promise.resolve(Result.ok(principal));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'TokenExpiredError') {
        return Promise.resolve(Result.err(new ExpiredTokenError()));
      }
      return Promise.resolve(Result.err(new InvalidTokenError()));
    }
  }
}
