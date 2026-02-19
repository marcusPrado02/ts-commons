/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Vitest mock objects require any-typed assignments */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- Vitest mock arguments */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Vitest mock property access */
/* eslint-disable @typescript-eslint/no-unsafe-call -- Vitest mock call patterns */
/* eslint-disable @typescript-eslint/no-unsafe-return -- Vitest mock return values */
/* eslint-disable @typescript-eslint/unbound-method -- Vitest mocking pattern requires unbound methods */
/* eslint-disable @typescript-eslint/explicit-function-return-type -- test helper functions */
/* eslint-disable max-lines-per-function -- test files naturally have longer functions */
/**
 * Tests for @acme/security — AuthN / AuthZ
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthError, InvalidTokenError, ExpiredTokenError } from './authn/AuthErrors';
import { JwtAuthenticator } from './authn/JwtAuthenticator';
import { ApiKeyAuthenticator } from './authn/ApiKeyAuthenticator';
import { RbacPolicyEngine } from './authz/RbacPolicyEngine';
import { Permission } from './authz/Permission';
import { PolicyDecision } from './authz/PolicyEnginePort';
import type { JwtVerifierLike } from './authn/JwtVerifierLike';
import type { AuthenticatedPrincipal } from './authn/AuthenticatedPrincipal';
import type { JwtClaims } from './authn/JwtClaims';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildVerifier(): JwtVerifierLike {
  return { verify: vi.fn() } as unknown as JwtVerifierLike;
}

function makePrincipal(id: string, roles: string[] = []): AuthenticatedPrincipal {
  return { id, roles, permissions: [] };
}

// ---------------------------------------------------------------------------
// AuthErrors
// ---------------------------------------------------------------------------

describe('AuthErrors', () => {
  it('InvalidTokenError has the correct name property', () => {
    const err = new InvalidTokenError();

    expect(err.name).toBe('InvalidTokenError');
    expect(err.message).toContain('Invalid');
  });

  it('ExpiredTokenError has the correct name property', () => {
    const err = new ExpiredTokenError();

    expect(err.name).toBe('ExpiredTokenError');
    expect(err.message).toContain('expired');
  });

  it('both error classes extend AuthError', () => {
    expect(new InvalidTokenError()).toBeInstanceOf(AuthError);
    expect(new ExpiredTokenError()).toBeInstanceOf(AuthError);
  });
});

// ---------------------------------------------------------------------------
// JwtAuthenticator
// ---------------------------------------------------------------------------

describe('JwtAuthenticator', () => {
  let verifier: JwtVerifierLike;
  let auth: JwtAuthenticator;

  beforeEach(() => {
    verifier = buildVerifier();
    auth     = new JwtAuthenticator(verifier, 'test-secret');
  });

  it('should return Result.ok with mapped principal for a valid token', async () => {
    vi.mocked(verifier.verify).mockReturnValue({
      sub: 'user-42', roles: ['admin'], permissions: ['user:read'],
    } as unknown as JwtClaims);

    const result = await auth.authenticate('valid.jwt.token');

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ id: 'user-42', roles: ['admin'], permissions: ['user:read'] });
    expect(verifier.verify).toHaveBeenCalledWith('valid.jwt.token', 'test-secret');
  });

  it('should include tenantId in principal when claim is present', async () => {
    vi.mocked(verifier.verify).mockReturnValue({
      sub: 'user-1', tenantId: 'tenant-acme', roles: [], permissions: [],
    } as unknown as JwtClaims);

    const result = await auth.authenticate('token');

    expect(result.unwrap().tenantId).toBe('tenant-acme');
  });

  it('should return Result.err(ExpiredTokenError) when verify throws TokenExpiredError', async () => {
    vi.mocked(verifier.verify).mockImplementation(() => {
      const err = new Error('jwt expired');
      err.name  = 'TokenExpiredError';
      throw err;
    });

    const result = await auth.authenticate('expired.token');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ExpiredTokenError);
  });

  it('should return Result.err(InvalidTokenError) for any other verification failure', async () => {
    vi.mocked(verifier.verify).mockImplementation(() => { throw new Error('invalid signature'); });

    const result = await auth.authenticate('bad.token');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(InvalidTokenError);
  });

  it('should strip the Bearer prefix before calling verify', async () => {
    vi.mocked(verifier.verify).mockReturnValue({
      sub: 'user-1', roles: [], permissions: [],
    } as unknown as JwtClaims);

    await auth.authenticate('Bearer my.jwt.token');

    expect(verifier.verify).toHaveBeenCalledWith('my.jwt.token', 'test-secret');
  });
});

// ---------------------------------------------------------------------------
// RbacPolicyEngine
// ---------------------------------------------------------------------------

describe('RbacPolicyEngine', () => {
  let engine: RbacPolicyEngine;

  beforeEach(() => {
    engine = new RbacPolicyEngine({
      admin:  ['user:read', 'user:write', 'user:delete'],
      viewer: ['user:read'],
    });
  });

  it('should return ALLOW when the principal role grants the required permission', async () => {
    const decision = await engine.evaluate(
      makePrincipal('u1', ['admin']),
      Permission.create('user:write'),
    );

    expect(decision).toBe(PolicyDecision.ALLOW);
  });

  it('should return DENY when the principal role does not grant the required permission', async () => {
    const decision = await engine.evaluate(
      makePrincipal('u1', ['viewer']),
      Permission.create('user:delete'),
    );

    expect(decision).toBe(PolicyDecision.DENY);
  });

  it('should return DENY when the principal has no roles', async () => {
    const decision = await engine.evaluate(
      makePrincipal('u1', []),
      Permission.create('user:read'),
    );

    expect(decision).toBe(PolicyDecision.DENY);
  });

  it('should return ALLOW when a later role in the list grants the permission', async () => {
    const decision = await engine.evaluate(
      makePrincipal('u1', ['viewer', 'admin']),
      Permission.create('user:delete'),
    );

    expect(decision).toBe(PolicyDecision.ALLOW);
  });

  it('should return DENY when the principal role is not defined in rolePermissions', async () => {
    const decision = await engine.evaluate(
      makePrincipal('u1', ['superadmin']),     // not in the map
      Permission.create('user:read'),
    );

    expect(decision).toBe(PolicyDecision.DENY);
  });

  it('should allow each permission listed in a single role', async () => {
    const readDecision = await engine.evaluate(
      makePrincipal('u1', ['admin']),
      Permission.create('user:read'),
    );
    const deleteDecision = await engine.evaluate(
      makePrincipal('u1', ['admin']),
      Permission.create('user:delete'),
    );

    expect(readDecision).toBe(PolicyDecision.ALLOW);
    expect(deleteDecision).toBe(PolicyDecision.ALLOW);
  });
});

// ---------------------------------------------------------------------------
// ApiKeyAuthenticator
// ---------------------------------------------------------------------------

describe('ApiKeyAuthenticator', () => {
  const svcPrincipal: AuthenticatedPrincipal = {
    id:          'svc-worker',
    roles:       ['service'],
    permissions: ['job:run'],
  };

  let auth: ApiKeyAuthenticator;

  beforeEach(() => {
    auth = new ApiKeyAuthenticator([{ apiKey: 'secret-key-abc', principal: svcPrincipal }]);
  });

  it('should return Result.ok(principal) for a registered API key', async () => {
    const result = await auth.authenticate('secret-key-abc');

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual(svcPrincipal);
  });

  it('should return Result.err(InvalidTokenError) for an unregistered key', async () => {
    const result = await auth.authenticate('unknown-key');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(InvalidTokenError);
  });

  it('should return Result.err(InvalidTokenError) for an empty string', async () => {
    const result = await auth.authenticate('');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(InvalidTokenError);
  });

  it('should strip the Bearer prefix before key lookup', async () => {
    const result = await auth.authenticate('Bearer secret-key-abc');

    expect(result.isOk()).toBe(true);
  });

  it('returned principal matches the configured entry exactly', async () => {
    const result = await auth.authenticate('secret-key-abc');
    const principal = result.unwrap();

    expect(principal.id).toBe('svc-worker');
    expect(principal.roles).toEqual(['service']);
    expect(principal.permissions).toEqual(['job:run']);
  });
});
