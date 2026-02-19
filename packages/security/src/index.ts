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
