import { Result } from '@acme/kernel';
import type { AuthenticatedPrincipal } from '../authn/AuthenticatedPrincipal';
import { type AuthError, InvalidTokenError } from '../authn/AuthErrors';
import type { SsoProviderConfig, SsoTokenPayload } from './types';

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Base class for OIDC-based SSO providers (Auth0, Okta, Azure AD, Google).
 * Each subclass customizes the userinfo endpoint and claim mapping.
 */
abstract class OidcSsoBase {
  protected constructor(
    protected readonly config: SsoProviderConfig,
    protected readonly fetch: FetchFn,
  ) {}

  abstract getProvider(): string;
  protected abstract getUserinfoUrl(): string;
  protected abstract mapClaims(data: Record<string, unknown>): SsoTokenPayload;

  async authenticate(token: string): Promise<Result<AuthenticatedPrincipal, AuthError>> {
    let data: Record<string, unknown>;
    try {
      const response = await this.fetch(this.getUserinfoUrl(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return Result.err(new InvalidTokenError());
      data = (await response.json()) as Record<string, unknown>;
    } catch {
      return Result.err(new InvalidTokenError());
    }

    const payload = this.mapClaims(data);
    if (!payload.sub) return Result.err(new InvalidTokenError());

    return Result.ok<AuthenticatedPrincipal, AuthError>({
      id: payload.sub,
      roles: payload.roles ?? [],
      permissions: [],
    });
  }
}

/**
 * Auth0 SSO authenticator.
 */
export class Auth0Authenticator extends OidcSsoBase {
  constructor(config: SsoProviderConfig, fetch: FetchFn) {
    super(config, fetch);
  }
  getProvider(): string {
    return 'auth0';
  }
  protected getUserinfoUrl(): string {
    return `${this.config.issuer}/userinfo`;
  }
  protected mapClaims(data: Record<string, unknown>): SsoTokenPayload {
    return {
      sub: typeof data['sub'] === 'string' ? data['sub'] : '',
      email: typeof data['email'] === 'string' ? data['email'] : undefined,
      name: typeof data['name'] === 'string' ? data['name'] : undefined,
      roles: Array.isArray(data['https://example.com/roles'])
        ? (data['https://example.com/roles'] as string[])
        : [],
      provider: 'auth0',
      raw: data,
    };
  }
}

/**
 * Okta SSO authenticator.
 */
export class OktaAuthenticator extends OidcSsoBase {
  constructor(config: SsoProviderConfig, fetch: FetchFn) {
    super(config, fetch);
  }
  getProvider(): string {
    return 'okta';
  }
  protected getUserinfoUrl(): string {
    return `${this.config.issuer}/v1/userinfo`;
  }
  protected mapClaims(data: Record<string, unknown>): SsoTokenPayload {
    const groups = Array.isArray(data['groups']) ? (data['groups'] as string[]) : [];
    return {
      sub: typeof data['sub'] === 'string' ? data['sub'] : '',
      email: typeof data['email'] === 'string' ? data['email'] : undefined,
      name: typeof data['name'] === 'string' ? data['name'] : undefined,
      roles: groups,
      provider: 'okta',
      raw: data,
    };
  }
}

/**
 * Azure AD SSO authenticator.
 */
export class AzureAdAuthenticator extends OidcSsoBase {
  constructor(config: SsoProviderConfig, fetch: FetchFn) {
    super(config, fetch);
  }
  getProvider(): string {
    return 'azure_ad';
  }
  protected getUserinfoUrl(): string {
    return 'https://graph.microsoft.com/oidc/userinfo';
  }
  protected mapClaims(data: Record<string, unknown>): SsoTokenPayload {
    const roles = Array.isArray(data['roles']) ? (data['roles'] as string[]) : [];
    return {
      sub: typeof data['sub'] === 'string' ? data['sub'] : '',
      email: typeof data['email'] === 'string' ? data['email'] : undefined,
      name: typeof data['name'] === 'string' ? data['name'] : undefined,
      roles,
      provider: 'azure_ad',
      raw: data,
    };
  }
}

/**
 * Google Workspace SSO authenticator.
 */
export class GoogleAuthenticator extends OidcSsoBase {
  constructor(config: SsoProviderConfig, fetch: FetchFn) {
    super(config, fetch);
  }
  getProvider(): string {
    return 'google';
  }
  protected getUserinfoUrl(): string {
    return 'https://openidconnect.googleapis.com/v1/userinfo';
  }
  protected mapClaims(data: Record<string, unknown>): SsoTokenPayload {
    return {
      sub: typeof data['sub'] === 'string' ? data['sub'] : '',
      email: typeof data['email'] === 'string' ? data['email'] : undefined,
      name: typeof data['name'] === 'string' ? data['name'] : undefined,
      roles: [],
      provider: 'google',
      raw: data,
    };
  }
}
