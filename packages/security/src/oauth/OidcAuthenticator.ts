import { Result } from '@acme/kernel';
import type { AuthenticatorPort } from '../authn/AuthenticatorPort';
import type { AuthenticatedPrincipal } from '../authn/AuthenticatedPrincipal';
import { AuthError, InvalidTokenError } from '../authn/AuthErrors';
import type { OidcClientLike, OidcUserInfo } from './types';

/**
 * OIDC Authenticator — implements AuthenticatorPort using an OIDC userinfo endpoint.
 * Fetches user info from the OIDC provider and maps claims to AuthenticatedPrincipal.
 */
export class OidcAuthenticator implements AuthenticatorPort {
  constructor(private readonly oidcClient: OidcClientLike) {}

  async authenticate(token: string): Promise<Result<AuthenticatedPrincipal, AuthError>> {
    let userInfo: OidcUserInfo;
    try {
      userInfo = await this.oidcClient.userinfo(token);
    } catch (err) {
      if (err instanceof AuthError) return Result.err(err);
      return Result.err(new InvalidTokenError());
    }

    if (!userInfo.sub) {
      return Result.err(new InvalidTokenError());
    }

    return Result.ok<AuthenticatedPrincipal, AuthError>({
      id: userInfo.sub,
      roles: userInfo.roles ?? [],
      permissions: [],
    });
  }
}
