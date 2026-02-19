# @acme/security

Authentication and Authorization primitives for the ACME monorepo.

## Overview

Provides a port-and-adapters model for AuthN/AuthZ:

| Abstraction | Role |
|---|---|
| `AuthenticatorPort` | Verifies an incoming credential and returns a typed `Result` |
| `PolicyEnginePort` | Evaluates whether a principal may perform a given action |
| `AuthenticatedPrincipal` | Identity record (id, tenantId?, roles, permissions) |
| `Permission` | Type-safe permission value object wrapping a string |
| `PolicyDecision` | `ALLOW` / `DENY` enum returned by the policy engine |

---

## Packages

### Authentication (`authn/`)

#### `JwtAuthenticator`

Validates a JWT using any injected `JwtVerifierLike` (e.g. `jsonwebtoken`).

```ts
import { JwtAuthenticator } from '@acme/security';
import jwt from 'jsonwebtoken';

const verifier = { verify: (token: string, secret: string) => jwt.verify(token, secret) };
const auth = new JwtAuthenticator(verifier, process.env.JWT_SECRET!);

const result = await auth.authenticate(req.headers.authorization ?? '');
if (result.isOk()) {
  const principal = result.unwrap();
  // principal: { id, tenantId?, roles, permissions }
}
```

- Automatically strips the `Bearer ` prefix.
- Maps `claims.sub → id`, `claims.tenantId → tenantId` (optional), `claims.roles`, `claims.permissions`.
- `TokenExpiredError` from the verifier → `ExpiredTokenError`; anything else → `InvalidTokenError`.

#### `ApiKeyAuthenticator`

Registry-based API key authentication for service-to-service calls.

```ts
import { ApiKeyAuthenticator } from '@acme/security';

const auth = new ApiKeyAuthenticator([
  { apiKey: process.env.WORKER_API_KEY!, principal: { id: 'svc-worker', roles: ['service'], permissions: [] } },
]);

const result = await auth.authenticate(apiKey);
```

Also strips the `Bearer ` prefix.

#### Error types

| Error | Extends | Meaning |
|---|---|---|
| `AuthError` | `Error` | Base authentication error |
| `InvalidTokenError` | `AuthError` | Token is malformed or signature invalid |
| `ExpiredTokenError` | `AuthError` | Token has expired |

---

### Authorization (`authz/`)

#### `RbacPolicyEngine`

Role-Based Access Control engine. Constructed with a `rolePermissions` map and implements `PolicyEnginePort`.

```ts
import { RbacPolicyEngine, Permission, PolicyDecision } from '@acme/security';

const engine = new RbacPolicyEngine({
  admin:  ['user:read', 'user:write', 'user:delete'],
  viewer: ['user:read'],
});

const decision = await engine.evaluate(principal, Permission.create('user:write'));
if (decision === PolicyDecision.ALLOW) { /* proceed */ }
```

---

## Extending

Implement `AuthenticatorPort` or `PolicyEnginePort` to add new adapters (OIDC, OPA, Cedar, etc.) without changing any consumer code.

```ts
import type { AuthenticatorPort, AuthenticatedPrincipal, AuthError } from '@acme/security';
import type { Result } from '@acme/kernel';

class OidcAuthenticator implements AuthenticatorPort {
  authenticate(token: string): Promise<Result<AuthenticatedPrincipal, AuthError>> {
    // ...
  }
}
```

---

## API

```
AuthenticatorPort           — interface authenticate(token): Promise<Result<Principal, AuthError>>
PolicyEnginePort            — interface evaluate(principal, permission): Promise<PolicyDecision>
AuthenticatedPrincipal      — { id, tenantId?, roles, permissions }
JwtClaims                   — { sub, iss?, exp?, iat?, [key]: unknown }
ApiKeyEntry                 — { apiKey, principal }
AuthError / InvalidTokenError / ExpiredTokenError
JwtVerifierLike             — structural: verify(token, secret): JwtClaims
JwtAuthenticator            — implements AuthenticatorPort via JWT
ApiKeyAuthenticator         — implements AuthenticatorPort via key registry
RbacPolicyEngine            — implements PolicyEnginePort via role map
Permission                  — ValueObject<string>
PolicyDecision              — enum ALLOW | DENY
```

---

## Installation

This is a private monorepo package — reference it via pnpm workspace:

```jsonc
// package.json
{ "dependencies": { "@acme/security": "workspace:*" } }
```
