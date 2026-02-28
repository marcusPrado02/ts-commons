import type { AuthenticatedPrincipal } from '../authn/AuthenticatedPrincipal';
import type { AuthError } from '../authn/AuthErrors';

/** Generic Result type for OAuth operations */
export type OAuthResult<T> = { ok: true; value: T } | { ok: false; error: AuthError };

export interface OAuthClientConfig {
  readonly clientId: string;
  readonly clientSecret?: string;
  readonly redirectUri?: string;
  readonly scopes?: string[];
  readonly tokenEndpoint: string;
  readonly authorizationEndpoint?: string;
  readonly introspectionEndpoint?: string;
  readonly revocationEndpoint?: string;
  readonly jwksUri?: string;
}

export interface TokenResponse {
  readonly accessToken: string;
  readonly tokenType: string;
  readonly expiresIn?: number;
  readonly refreshToken?: string;
  readonly scope?: string;
  readonly idToken?: string;
}

export interface TokenIntrospectionResult {
  readonly active: boolean;
  readonly sub?: string;
  readonly clientId?: string;
  readonly scope?: string;
  readonly exp?: number;
  readonly username?: string;
  readonly tokenType?: string;
}

export interface OidcUserInfo {
  readonly sub: string;
  readonly email?: string;
  readonly emailVerified?: boolean;
  readonly name?: string;
  readonly roles?: string[];
  readonly [key: string]: unknown;
}

export interface JwksKey {
  readonly kty: string;
  readonly kid?: string;
  readonly use?: string;
  readonly alg?: string;
  readonly n?: string; // RSA modulus
  readonly e?: string; // RSA exponent
  readonly x?: string; // EC x
  readonly y?: string; // EC y
  readonly crv?: string;
}

export interface JwksDocument {
  readonly keys: JwksKey[];
}

export interface PkceChallenge {
  readonly codeVerifier: string;
  readonly codeChallenge: string;
  readonly codeChallengeMethod: 'S256' | 'plain';
}

export interface AuthorizationCodeParams {
  readonly state: string;
  readonly codeVerifier?: string; // PKCE
}

export interface OAuthTokenStore {
  save(token: TokenResponse, key: string): Promise<void>;
  load(key: string): Promise<TokenResponse | null>;
  revoke(key: string): Promise<void>;
}

export interface OidcClientLike {
  userinfo(accessToken: string): Promise<OidcUserInfo>;
  authenticate(token: string): Promise<OAuthResult<AuthenticatedPrincipal>>;
}
