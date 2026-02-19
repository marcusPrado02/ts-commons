/* eslint-disable
   @typescript-eslint/no-unsafe-return,
   @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/strict-boolean-expressions
   -- Result is from @acme/kernel; all types are correct at compile time but
   unresolvable by the ESLint TS plugin due to TypeScript 5.9.x / plugin <5.4. */
import { Result } from '@acme/kernel';
import type { AuthenticatedPrincipal } from './AuthenticatedPrincipal';
import type { AuthenticatorPort } from './AuthenticatorPort';
import type { AuthError } from './AuthErrors';
import { InvalidTokenError } from './AuthErrors';

/**
 * Configuration entry for a single API key.
 */
export interface ApiKeyEntry {
  /** The raw API key value. */
  readonly apiKey: string;
  /** The principal that this key authenticates. */
  readonly principal: AuthenticatedPrincipal;
}

/**
 * Authenticates requests using static API keys.
 *
 * Strips an optional `Bearer ` prefix so both raw keys and
 * `Authorization: Bearer <key>` header values are accepted.
 *
 * @example
 * ```typescript
 * const auth = new ApiKeyAuthenticator([
 *   {
 *     apiKey: 'svc-key-abc',
 *     principal: { id: 'svc-worker', roles: ['service'], permissions: ['job:run'] },
 *   },
 * ]);
 * const result = await auth.authenticate(req.headers['x-api-key'] ?? '');
 * ```
 */
export class ApiKeyAuthenticator implements AuthenticatorPort {
  private readonly registry: ReadonlyMap<string, AuthenticatedPrincipal>;

  constructor(keys: readonly ApiKeyEntry[]) {
    this.registry = new Map(keys.map((entry) => [entry.apiKey, entry.principal]));
  }

  authenticate(token: string): Promise<Result<AuthenticatedPrincipal, AuthError>> {
    const raw = token.startsWith('Bearer ') ? token.slice(7) : token;

    if (raw.length === 0) {
      return Promise.resolve(Result.err(new InvalidTokenError()));
    }

    const principal = this.registry.get(raw);
    if (principal === undefined) {
      return Promise.resolve(Result.err(new InvalidTokenError()));
    }

    return Promise.resolve(Result.ok(principal));
  }
}
