/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { AuthorizationCodeFlow } from './AuthorizationCodeFlow';
import { ClientCredentialsFlow } from './ClientCredentialsFlow';
import { PkceGenerator } from './PkceGenerator';
import { TokenIntrospector } from './TokenIntrospector';
import { JwksClient } from './JwksClient';
import { OidcAuthenticator } from './OidcAuthenticator';
import type { OAuthClientConfig, OidcUserInfo } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<OAuthClientConfig> = {}): OAuthClientConfig {
  return {
    clientId: 'client123',
    clientSecret: 'secret',
    tokenEndpoint: 'https://auth.example.com/token',
    redirectUri: 'https://app.example.com/callback',
    scopes: ['openid', 'profile'],
    authorizationEndpoint: 'https://auth.example.com/authorize',
    introspectionEndpoint: 'https://auth.example.com/introspect',
    revocationEndpoint: 'https://auth.example.com/revoke',
    jwksUri: 'https://auth.example.com/.well-known/jwks.json',
    ...overrides,
  };
}

function makeFetch(
  body: unknown,
  status = 200,
): (url: string, init?: RequestInit) => Promise<Response> {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
  } as Response);
}

// ─── AuthorizationCodeFlow ────────────────────────────────────────────────────

describe('AuthorizationCodeFlow', () => {
  it('builds authorization URL with required params', () => {
    const flow = new AuthorizationCodeFlow(makeConfig(), makeFetch({}));
    const url = flow.buildAuthorizationUrl('state123');
    expect(url).toContain('response_type=code');
    expect(url).toContain('client_id=client123');
    expect(url).toContain('state=state123');
    expect(url).toContain('redirect_uri=');
    expect(url).toContain('scope=openid+profile');
  });

  it('includes PKCE params when pkce provided', () => {
    const flow = new AuthorizationCodeFlow(makeConfig(), makeFetch({}));
    const pkce = PkceGenerator.generate('S256');
    const url = flow.buildAuthorizationUrl('state1', pkce);
    expect(url).toContain('code_challenge=');
    expect(url).toContain('code_challenge_method=S256');
  });

  it('throws when authorizationEndpoint missing', () => {
    const flow = new AuthorizationCodeFlow(
      makeConfig({ authorizationEndpoint: undefined } as any),
      makeFetch({}),
    );
    expect(() => flow.buildAuthorizationUrl('s')).toThrow('authorizationEndpoint');
  });

  it('exchanges code for tokens', async () => {
    const tokenData = {
      access_token: 'at',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'rt',
      id_token: 'it',
      scope: 'openid',
    };
    const flow = new AuthorizationCodeFlow(makeConfig(), makeFetch(tokenData));
    const result = await flow.exchangeCode('code123');
    expect(result.accessToken).toBe('at');
    expect(result.refreshToken).toBe('rt');
    expect(result.idToken).toBe('it');
    expect(result.expiresIn).toBe(3600);
  });

  it('includes code_verifier when PKCE exchangeCode', async () => {
    const fetchFn = makeFetch({ access_token: 'at', token_type: 'Bearer' });
    const flow = new AuthorizationCodeFlow(makeConfig(), fetchFn);
    await flow.exchangeCode('code', 'verifier');
    const body = (fetchFn as any).mock.calls[0][1].body as string;
    expect(body).toContain('code_verifier=verifier');
  });

  it('refreshes token using refresh_token grant', async () => {
    const fetchFn = makeFetch({ access_token: 'new-at', token_type: 'Bearer' });
    const flow = new AuthorizationCodeFlow(makeConfig(), fetchFn);
    const result = await flow.refreshToken('existing-rt');
    expect(result.accessToken).toBe('new-at');
    const body = (fetchFn as any).mock.calls[0][1].body as string;
    expect(body).toContain('grant_type=refresh_token');
  });

  it('throws on non-ok response', async () => {
    const flow = new AuthorizationCodeFlow(makeConfig(), makeFetch({}, 401));
    await expect(flow.exchangeCode('code')).rejects.toThrow('Token request failed');
  });
});

// ─── ClientCredentialsFlow ────────────────────────────────────────────────────

describe('ClientCredentialsFlow', () => {
  it('requests token with client_credentials grant', async () => {
    const fetchFn = makeFetch({ access_token: 'cc-token', token_type: 'Bearer', expires_in: 1800 });
    const flow = new ClientCredentialsFlow(makeConfig(), fetchFn);
    const result = await flow.getToken();
    expect(result.accessToken).toBe('cc-token');
    const body = (fetchFn as any).mock.calls[0][1].body as string;
    expect(body).toContain('grant_type=client_credentials');
  });

  it('merges additional scopes', async () => {
    const fetchFn = makeFetch({ access_token: 'tok', token_type: 'Bearer' });
    const flow = new ClientCredentialsFlow(makeConfig(), fetchFn);
    await flow.getToken(['extra-scope']);
    const body = (fetchFn as any).mock.calls[0][1].body as string;
    expect(body).toContain('scope=openid+profile+extra-scope');
  });

  it('throws on non-ok response', async () => {
    const flow = new ClientCredentialsFlow(makeConfig(), makeFetch({}, 403));
    await expect(flow.getToken()).rejects.toThrow('Client credentials request failed');
  });
});

// ─── PkceGenerator ────────────────────────────────────────────────────────────

describe('PkceGenerator', () => {
  it('generates verifier and challenge', () => {
    const pkce = PkceGenerator.generate('S256');
    expect(pkce.codeVerifier).toBeTruthy();
    expect(pkce.codeChallenge).toBeTruthy();
    expect(pkce.codeChallengeMethod).toBe('S256');
  });

  it('generates plain method challenge', () => {
    const pkce = PkceGenerator.generate('plain');
    expect(pkce.codeVerifier).toBe(pkce.codeChallenge);
    expect(pkce.codeChallengeMethod).toBe('plain');
  });

  it('generates unique verifiers each time', () => {
    const a = PkceGenerator.generateVerifier();
    const b = PkceGenerator.generateVerifier();
    expect(a).not.toBe(b);
  });

  it('base64UrlEncode produces URL-safe chars', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xfe]);
    const encoded = PkceGenerator.base64UrlEncode(bytes);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  it('verify returns true when challenge matches verifier', () => {
    const pkce = PkceGenerator.generate('S256');
    expect(PkceGenerator.verify(pkce.codeVerifier, pkce.codeChallenge, 'S256')).toBe(true);
  });

  it('verify returns false when challenge differs', () => {
    const pkce = PkceGenerator.generate('S256');
    expect(PkceGenerator.verify('wrong-verifier', pkce.codeChallenge, 'S256')).toBe(false);
  });
});

// ─── TokenIntrospector ───────────────────────────────────────────────────────

describe('TokenIntrospector', () => {
  it('introspects active token', async () => {
    const data = {
      active: true,
      sub: 'user1',
      client_id: 'c1',
      scope: 'openid',
      exp: 9999,
      token_type: 'Bearer',
    };
    const fetchFn = makeFetch(data);
    const introspector = new TokenIntrospector(makeConfig(), fetchFn);
    const result = await introspector.introspect('my-token');
    expect(result.active).toBe(true);
    expect(result.sub).toBe('user1');
    expect(result.exp).toBe(9999);
  });

  it('introspects inactive token', async () => {
    const fetchFn = makeFetch({ active: false });
    const introspector = new TokenIntrospector(makeConfig(), fetchFn);
    const result = await introspector.introspect('bad-token');
    expect(result.active).toBe(false);
  });

  it('includes token_type_hint when provided', async () => {
    const fetchFn = makeFetch({ active: true });
    const introspector = new TokenIntrospector(makeConfig(), fetchFn);
    await introspector.introspect('token', 'access_token');
    const body = (fetchFn as any).mock.calls[0][1].body as string;
    expect(body).toContain('token_type_hint=access_token');
  });

  it('throws when introspectionEndpoint missing', async () => {
    const introspector = new TokenIntrospector(
      makeConfig({ introspectionEndpoint: undefined } as any),
      makeFetch({}),
    );
    await expect(introspector.introspect('t')).rejects.toThrow('introspectionEndpoint');
  });

  it('revokes token', async () => {
    const fetchFn = makeFetch({});
    const introspector = new TokenIntrospector(makeConfig(), fetchFn);
    await expect(introspector.revoke('token')).resolves.toBeUndefined();
    const body = (fetchFn as any).mock.calls[0][1].body as string;
    expect(body).toContain('token=token');
  });

  it('throws revoke when revocationEndpoint missing', async () => {
    const introspector = new TokenIntrospector(
      makeConfig({ revocationEndpoint: undefined } as any),
      makeFetch({}),
    );
    await expect(introspector.revoke('token')).rejects.toThrow('revocationEndpoint');
  });
});

// ─── JwksClient ──────────────────────────────────────────────────────────────

describe('JwksClient', () => {
  const jwks = {
    keys: [
      { kty: 'RSA', kid: 'key1', use: 'sig', alg: 'RS256', n: 'abc', e: 'AQAB' },
      { kty: 'RSA', kid: 'key2', use: 'enc', alg: 'RS256' },
    ],
  };

  it('fetches and caches keys', async () => {
    const fetchFn = makeFetch(jwks);
    const client = new JwksClient('https://example.com/jwks', fetchFn);
    const keys = await client.getKeys();
    expect(keys).toHaveLength(2);
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('returns cached keys on second call', async () => {
    const fetchFn = makeFetch(jwks);
    const client = new JwksClient('https://example.com/jwks', fetchFn, { cacheTtlMs: 60000 });
    await client.getKeys();
    await client.getKeys();
    // Only fetched once
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('re-fetches when forceRefresh=true', async () => {
    const fetchFn = makeFetch(jwks);
    const client = new JwksClient('https://example.com/jwks', fetchFn);
    await client.getKeys();
    await client.getKeys(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('finds key by kid', async () => {
    const fetchFn = makeFetch(jwks);
    const client = new JwksClient('https://example.com/jwks', fetchFn);
    const key = await client.getKey('key1');
    expect(key?.kid).toBe('key1');
    expect(key?.alg).toBe('RS256');
  });

  it('returns null for unknown kid after re-fetch', async () => {
    const fetchFn = makeFetch(jwks);
    const client = new JwksClient('https://example.com/jwks', fetchFn);
    const key = await client.getKey('unknown');
    expect(key).toBeNull();
  });

  it('filters keys by use', async () => {
    const fetchFn = makeFetch(jwks);
    const client = new JwksClient('https://example.com/jwks', fetchFn);
    const sigKeys = await client.getKeysByUse('sig');
    expect(sigKeys).toHaveLength(1);
    expect(sigKeys[0]?.kid).toBe('key1');
  });

  it('clearCache resets state', async () => {
    const fetchFn = makeFetch(jwks);
    const client = new JwksClient('https://example.com/jwks', fetchFn);
    await client.getKeys();
    expect(client.cacheSize()).toBe(2);
    client.clearCache();
    expect(client.cacheSize()).toBe(0);
  });

  it('throws on failed fetch', async () => {
    const fetchFn = makeFetch({}, 500);
    const client = new JwksClient('https://example.com/jwks', fetchFn);
    await expect(client.getKeys()).rejects.toThrow('JWKS fetch failed');
  });
});

// ─── OidcAuthenticator ────────────────────────────────────────────────────────

describe('OidcAuthenticator', () => {
  const makeOidcClient = (info: Partial<OidcUserInfo> | null) => ({
    userinfo: vi.fn().mockResolvedValue(info ?? {}),
    authenticate: vi.fn(),
  });

  it('returns ok principal on valid userinfo', async () => {
    const client = makeOidcClient({ sub: 'u1', email: 'u@test.com', roles: ['admin'] });
    const authenticator = new OidcAuthenticator(client);
    const result = await authenticator.authenticate('valid-token');
    expect(result.isOk()).toBe(true);
    const principal = result.unwrap();
    expect(principal.id).toBe('u1');
    expect(principal.roles).toContain('admin');
  });

  it('returns err when sub is missing', async () => {
    const client = makeOidcClient({ email: 'x@test.com' });
    const authenticator = new OidcAuthenticator(client);
    const result = await authenticator.authenticate('token');
    expect(result.isErr()).toBe(true);
  });

  it('returns err when userinfo throws', async () => {
    const client = {
      userinfo: vi.fn().mockRejectedValue(new Error('network')),
      authenticate: vi.fn(),
    };
    const authenticator = new OidcAuthenticator(client);
    const result = await authenticator.authenticate('bad');
    expect(result.isErr()).toBe(true);
  });

  it('propagates AuthError from client', async () => {
    const { InvalidTokenError } = await import('../authn/AuthErrors');
    const client = {
      userinfo: vi.fn().mockRejectedValue(new InvalidTokenError()),
      authenticate: vi.fn(),
    };
    const authenticator = new OidcAuthenticator(client);
    const result = await authenticator.authenticate('token');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(InvalidTokenError);
  });

  it('defaults empty roles when not provided', async () => {
    const client = makeOidcClient({ sub: 'u2' });
    const authenticator = new OidcAuthenticator(client);
    const result = await authenticator.authenticate('token');
    expect(result.unwrap().roles).toEqual([]);
  });
});
