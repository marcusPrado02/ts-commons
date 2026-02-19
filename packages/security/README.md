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

### Cryptography (`crypto/`)

All adapters use Node.js built-in `node:crypto` — no third-party runtime dependencies.

#### `AesGcmCipher`

AES-256-GCM authenticated encryption.  A fresh random IV is generated per `encrypt` call.  The key string is normalised to 256 bits via SHA-256, so any string length is accepted.

```ts
import { AesGcmCipher } from '@acme/security';

const cipher = new AesGcmCipher();
const result = cipher.encrypt('my secret', process.env.ENCRYPTION_KEY!);
// result → { ciphertext: '…hex…', iv: '…hex…', tag: '…hex…' }

const plain = cipher.decrypt(result, process.env.ENCRYPTION_KEY!);
// plain → 'my secret'
```

`decrypt` throws if the key or auth tag is wrong — ensuring authenticated decryption.

#### `Sha256Hasher`

Deterministic SHA-256 hex digest. Suitable for checksums and fingerprinting; for passwords use a slow KDF instead.

```ts
import { Sha256Hasher } from '@acme/security';

const hasher = new Sha256Hasher();
hasher.hash('hello');
// → '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
```

#### `HmacSha256Signer`

HMAC-SHA256 signing / verification.  Uses `timingSafeEqual` in `verify` to prevent timing-based side-channel attacks.

```ts
import { HmacSha256Signer } from '@acme/security';

const signer = new HmacSha256Signer();
const sig = signer.sign('payload', process.env.HMAC_KEY!);
signer.verify('payload', process.env.HMAC_KEY!, sig); // true
```

#### `PiiMasker`

General-purpose PII masker.  Replaces the middle of a string with `*` (or a custom character), leaving an optional visible prefix and/or suffix.

```ts
import { PiiMasker } from '@acme/security';

const masker = new PiiMasker();

masker.mask('user@example.com', { visibleSuffix: 11 });
// → '****@example.com'

masker.mask('4111111111111111', { visibleSuffix: 4 });
// → '************1111'

masker.mask('+1-800-555-0100', { visiblePrefix: 3, visibleSuffix: 4 });
// → '+1-********0100'

masker.mask('sensitive', { maskChar: '#' });
// → '#########'
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

CipherResult                — { ciphertext, iv, tag } — all hex-encoded
CipherPort                  — interface encrypt/decrypt
HasherPort                  — interface hash(data): string
HmacPort                    — interface sign/verify
MaskOptions                 — { visiblePrefix?, visibleSuffix?, maskChar? }
MaskerPort                  — interface mask(value, options?): string
AesGcmCipher                — implements CipherPort via AES-256-GCM
Sha256Hasher                — implements HasherPort via SHA-256
HmacSha256Signer            — implements HmacPort via HMAC-SHA256
PiiMasker                   — implements MaskerPort
```

---

## Installation

This is a private monorepo package — reference it via pnpm workspace:

```jsonc
// package.json
{ "dependencies": { "@acme/security": "workspace:*" } }
```
