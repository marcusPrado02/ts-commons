import type { AuthenticatedPrincipal } from '../authn/AuthenticatedPrincipal';
import type { AuthError } from '../authn/AuthErrors';
import type { Result } from '@acme/kernel';

export interface SsoProviderConfig {
  /** OAuth2/OIDC discovery URL or explicit endpoint configuration */
  readonly issuer: string;
  readonly clientId: string;
  readonly clientSecret?: string;
  readonly redirectUri?: string;
  readonly scopes?: string[];
}

export interface SamlConfig {
  /** Identity Provider (IdP) SSO URL */
  readonly idpSsoUrl: string;
  /** IdP certificate for signature verification */
  readonly idpCertificate: string;
  /** Service Provider entity ID */
  readonly spEntityId: string;
  /** Service Provider ACS (Assertion Consumer Service) URL */
  readonly spAcsUrl: string;
}

export interface SamlAssertion {
  readonly nameId: string;
  readonly sessionIndex?: string;
  readonly attributes: Record<string, string | string[]>;
  readonly conditions?: {
    notBefore?: string;
    notOnOrAfter?: string;
  };
}

export interface SsoTokenPayload {
  readonly sub: string;
  readonly email?: string;
  readonly name?: string;
  readonly roles?: string[];
  readonly provider: string;
  readonly raw?: Record<string, unknown>;
}

export interface SsoAuthenticator {
  authenticate(token: string): Promise<Result<AuthenticatedPrincipal, AuthError>>;
  getProvider(): string;
}
