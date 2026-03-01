# @acme/security

Authentication, authorisation, OAuth2, encryption, and PII masking.

**Install:** `pnpm add @acme/security @acme/kernel`

---

## `JwtAuthenticator` — Token Verification

```typescript
import { JwtAuthenticator } from '@acme/security';

const authenticator = new JwtAuthenticator(jwtVerifier, {
  issuer: 'https://auth.example.com',
  audience: 'orders-service',
  leeway: 30, // clock skew tolerance in seconds
});

const result = await authenticator.authenticate(bearerToken);

result.match({
  ok: (principal) => {
    console.log('User:', principal.id);
    console.log('Roles:', principal.roles);
    console.log('Scopes:', principal.scopes);
  },
  err: (err) => reply.status(401).send({ error: err.message }),
});
```

---

## `RbacPolicyEngine` — Role-Based Access Control

```typescript
import { RbacPolicyEngine } from '@acme/security';

const engine = new RbacPolicyEngine({
  roles: {
    admin: ['order:read', 'order:write', 'order:delete', 'order:admin'],
    customer: ['order:read', 'order:write'],
    viewer: ['order:read'],
  },
});

// Check permission
const canPlace = engine.isAllowed(principal, 'order:write'); // boolean
const canDelete = engine.isAllowed(principal, 'order:delete');

// Assert (throws UnauthorizedError if denied)
engine.assertAllowed(principal, 'order:delete');
```

---

## `ClientCredentialsFlow` — OAuth2 Server-to-Server

```typescript
import { ClientCredentialsFlow } from '@acme/security';

const flow = new ClientCredentialsFlow(
  {
    clientId: process.env.CLIENT_ID!,
    clientSecret: process.env.CLIENT_SECRET!,
    tokenEndpoint: 'https://auth.example.com/oauth/token',
    scopes: ['payments:read', 'payments:write'],
  },
  fetch,
);

// Automatically caches token until expiry
const token = await flow.getToken();
// token.accessToken, token.expiresIn, token.tokenType
```

---

## `TokenIntrospector` — Token Inspection

```typescript
import { TokenIntrospector } from '@acme/security';

const introspector = new TokenIntrospector(
  {
    introspectionEndpoint: 'https://auth.example.com/oauth/introspect',
    clientId: process.env.CLIENT_ID!,
    clientSecret: process.env.CLIENT_SECRET!,
  },
  fetch,
);

const info = await introspector.introspect(accessToken);

if (!info.active) throw new UnauthorizedError('Token inactive');

console.log('Subject:', info.sub);
console.log('Scope:', info.scope);
console.log('Expires:', info.exp);
```

---

## `AesGcmCipher` — Encryption

Encrypts sensitive data at rest (e.g. credit card numbers, national IDs).

```typescript
import { AesGcmCipher } from '@acme/security';

const cipher = new AesGcmCipher(process.env.ENCRYPTION_KEY!);

// Encrypt
const ciphertext = await cipher.encrypt('4111-1111-1111-1111');

// Decrypt
const plaintext = await cipher.decrypt(ciphertext);
```

`AesGcmCipher` uses AES-256-GCM. The key must be a 32-byte hex string. Each encryption produces a unique nonce, stored alongside the ciphertext.

---

## `PiiMasker` — Log-Safe PII Masking

Masks personally identifiable information for display in logs, UIs, etc.

```typescript
import { PiiMasker } from '@acme/security';

const masker = new PiiMasker();

masker.mask('email', 'user@example.com'); // → "u***@example.com"
masker.mask('cpf', '123.456.789-09'); // → "***.***.***-09"
masker.mask('phone', '+5511987654321'); // → "+55119*****4321"
masker.mask('card', '4111111111111111'); // → "411111******1111"
```

Custom rules:

```typescript
const masker = new PiiMasker({
  rules: {
    patientId: (value) => `PT-${value.slice(-4).padStart(value.length, '*')}`,
  },
});
```

---

## Middleware Pattern (Fastify)

```typescript
import { JwtAuthenticator, RbacPolicyEngine } from '@acme/security';

const withAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) return reply.status(401).send({ error: 'Missing token' });

  const result = await authenticator.authenticate(token);
  if (result.isErr()) return reply.status(401).send({ error: 'Invalid token' });

  const principal = result.unwrap();
  if (!engine.isAllowed(principal, 'order:write')) {
    return reply.status(403).send({ error: 'Forbidden' });
  }

  request.user = principal;
};

app.post('/orders', { preHandler: withAuth }, handler);
```

---

## Summary

| Export                  | Purpose                               |
| ----------------------- | ------------------------------------- |
| `JwtAuthenticator`      | Verify and decode JWT bearer tokens   |
| `RbacPolicyEngine`      | Role-based permission checks          |
| `ClientCredentialsFlow` | OAuth2 client credentials grant (M2M) |
| `TokenIntrospector`     | OAuth2 token introspection            |
| `AesGcmCipher`          | AES-256-GCM encryption/decryption     |
| `PiiMasker`             | Mask PII fields for logs and display  |
| `UnauthorizedError`     | 401 domain error                      |
| `ForbiddenError`        | 403 domain error                      |
