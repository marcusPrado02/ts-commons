// AuthN — errors
export { AuthError, InvalidTokenError, ExpiredTokenError } from './authn/AuthErrors';

// AuthN — interfaces
export type { JwtClaims } from './authn/JwtClaims';
export type { AuthenticatedPrincipal } from './authn/AuthenticatedPrincipal';
export type { AuthenticatorPort } from './authn/AuthenticatorPort';
export type { JwtVerifierLike } from './authn/JwtVerifierLike';

// AuthN — adapters
export { JwtAuthenticator } from './authn/JwtAuthenticator';
export { ApiKeyAuthenticator } from './authn/ApiKeyAuthenticator';
export type { ApiKeyEntry } from './authn/ApiKeyAuthenticator';

// AuthZ — interfaces + value objects
export { Permission } from './authz/Permission';
export { PolicyDecision } from './authz/PolicyEnginePort';
export type { PolicyEnginePort } from './authz/PolicyEnginePort';

// AuthZ — engines
export { RbacPolicyEngine } from './authz/RbacPolicyEngine';

// Crypto — interfaces
export type { CipherResult, CipherPort } from './crypto/CipherPort';
export type { HasherPort } from './crypto/HasherPort';
export type { HmacPort } from './crypto/HmacPort';
export type { MaskOptions, MaskerPort } from './crypto/MaskerPort';

// Crypto — adapters
export { AesGcmCipher } from './crypto/AesGcmCipher';
export { Sha256Hasher } from './crypto/Sha256Hasher';
export { HmacSha256Signer } from './crypto/HmacSha256Signer';
export { PiiMasker } from './crypto/PiiMasker';

// OAuth2 / OIDC
export {
  AuthorizationCodeFlow,
  ClientCredentialsFlow,
  PkceGenerator,
  TokenIntrospector,
  JwksClient,
  OidcAuthenticator,
} from './oauth/index';
export type {
  OAuthClientConfig,
  TokenResponse,
  TokenIntrospectionResult,
  OidcUserInfo,
  JwksKey,
  JwksDocument,
  PkceChallenge,
  AuthorizationCodeParams,
  OAuthTokenStore,
  OidcClientLike,
  OAuthResult,
} from './oauth/index';
