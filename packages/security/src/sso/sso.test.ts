/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { SamlAuthenticator } from './SamlAuthenticator';
import {
  Auth0Authenticator,
  OktaAuthenticator,
  AzureAdAuthenticator,
  GoogleAuthenticator,
} from './OidcSsoProviders';
import type { SamlAssertion } from './types';

// ──────────────────────────────────────────────────────────────────────────────
// SAML Authenticator
// ──────────────────────────────────────────────────────────────────────────────

const samlConfig = {
  idpSsoUrl: 'https://idp.example.com/sso',
  idpCertificate: 'CERT',
  spEntityId: 'https://sp.example.com',
  spAcsUrl: 'https://sp.example.com/acs',
};

function validAssertion(overrides: Partial<SamlAssertion> = {}): SamlAssertion {
  return {
    nameId: 'user@example.com',
    attributes: { email: 'user@example.com', roles: ['admin'] },
    ...overrides,
  };
}

describe('SamlAuthenticator', () => {
  it('returns ok principal for valid assertion', () => {
    const auth = new SamlAuthenticator(samlConfig);
    const result = auth.fromAssertion(validAssertion());
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().id).toBe('user@example.com');
  });

  it('returns error when nameId is empty', () => {
    const auth = new SamlAuthenticator(samlConfig);
    const result = auth.fromAssertion(validAssertion({ nameId: '' }));
    expect(result.isOk()).toBe(false);
  });

  it('returns error when assertion is expired', () => {
    const auth = new SamlAuthenticator(samlConfig);
    const result = auth.fromAssertion(
      validAssertion({
        conditions: { notOnOrAfter: new Date(Date.now() - 60_000).toISOString() },
      }),
    );
    expect(result.isOk()).toBe(false);
  });

  it('returns error when assertion is not yet valid', () => {
    const auth = new SamlAuthenticator(samlConfig);
    const result = auth.fromAssertion(
      validAssertion({
        conditions: { notBefore: new Date(Date.now() + 60_000).toISOString() },
      }),
    );
    expect(result.isOk()).toBe(false);
  });

  it('accepts assertion when time conditions are in valid range', () => {
    const auth = new SamlAuthenticator(samlConfig);
    const result = auth.fromAssertion(
      validAssertion({
        conditions: {
          notBefore: new Date(Date.now() - 60_000).toISOString(),
          notOnOrAfter: new Date(Date.now() + 60_000).toISOString(),
        },
      }),
    );
    expect(result.isOk()).toBe(true);
  });

  it('extracts roles from assertion attributes', () => {
    const auth = new SamlAuthenticator(samlConfig);
    const result = auth.fromAssertion(
      validAssertion({
        attributes: { roles: ['admin', 'editor'] },
      }),
    );
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().roles).toEqual(['admin', 'editor']);
  });

  it('extracts roles from MS claim URI', () => {
    const auth = new SamlAuthenticator(samlConfig);
    const result = auth.fromAssertion(
      validAssertion({
        attributes: {
          'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'Contributor',
        },
      }),
    );
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().roles).toContain('Contributor');
  });

  it('returns empty roles when no role attribute is present', () => {
    const auth = new SamlAuthenticator(samlConfig);
    const result = auth.fromAssertion(validAssertion({ attributes: {} }));
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().roles).toEqual([]);
  });

  it('getProvider returns saml2', () => {
    expect(new SamlAuthenticator(samlConfig).getProvider()).toBe('saml2');
  });

  it('buildAuthRequestUrl includes SAMLRequest and SigAlg', () => {
    const auth = new SamlAuthenticator(samlConfig);
    const url = auth.buildAuthRequestUrl();
    expect(url).toContain('SAMLRequest=');
    expect(url).toContain('SigAlg=');
    expect(url.startsWith('https://idp.example.com/sso?')).toBe(true);
  });

  it('buildAuthRequestUrl includes RelayState when provided', () => {
    const auth = new SamlAuthenticator(samlConfig);
    const url = auth.buildAuthRequestUrl('target=/dashboard');
    expect(url).toContain('RelayState=');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// OIDC SSO Providers
// ──────────────────────────────────────────────────────────────────────────────

function makeFetch(userinfo: Record<string, unknown>, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => userinfo,
  });
}

const oidcConfig = {
  issuer: 'https://dev-example.auth0.com',
  clientId: 'client123',
};

describe('Auth0Authenticator', () => {
  it('getProvider returns auth0', () => {
    const auth = new Auth0Authenticator(oidcConfig, makeFetch({}));
    expect(auth.getProvider()).toBe('auth0');
  });

  it('authenticate returns ok principal for valid token', async () => {
    const fetch = makeFetch({
      sub: 'auth0|123',
      email: 'a@b.com',
      name: 'Alice',
      'https://example.com/roles': ['admin'],
    });
    const auth = new Auth0Authenticator(oidcConfig, fetch);
    const result = await auth.authenticate('token123');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().id).toBe('auth0|123');
    expect(result.unwrap().roles).toContain('admin');
  });

  it('authenticate returns error on 401', async () => {
    const auth = new Auth0Authenticator(oidcConfig, makeFetch({}, 401));
    const result = await auth.authenticate('bad-token');
    expect(result.isOk()).toBe(false);
  });

  it('authenticate returns error when sub is missing', async () => {
    const auth = new Auth0Authenticator(oidcConfig, makeFetch({ email: 'a@b.com' }));
    const result = await auth.authenticate('token');
    expect(result.isOk()).toBe(false);
  });
});

describe('OktaAuthenticator', () => {
  it('getProvider returns okta', () => {
    const auth = new OktaAuthenticator(oidcConfig, makeFetch({}));
    expect(auth.getProvider()).toBe('okta');
  });

  it('authenticate maps groups to roles', async () => {
    const fetch = makeFetch({ sub: 'okta|abc', groups: ['Everyone', 'Admins'] });
    const auth = new OktaAuthenticator(oidcConfig, fetch);
    const result = await auth.authenticate('token');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().roles).toContain('Admins');
  });

  it('authenticate returns error on network failure', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('network'));
    const auth = new OktaAuthenticator(oidcConfig, fetch as any);
    const result = await auth.authenticate('token');
    expect(result.isOk()).toBe(false);
  });
});

describe('AzureAdAuthenticator', () => {
  it('getProvider returns azure_ad', () => {
    const auth = new AzureAdAuthenticator(oidcConfig, makeFetch({}));
    expect(auth.getProvider()).toBe('azure_ad');
  });

  it('authenticate extracts roles', async () => {
    const fetch = makeFetch({ sub: 'az|xyz', roles: ['Reader', 'Contributor'] });
    const auth = new AzureAdAuthenticator(oidcConfig, fetch);
    const result = await auth.authenticate('token');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().roles).toContain('Reader');
  });
});

describe('GoogleAuthenticator', () => {
  it('getProvider returns google', () => {
    const auth = new GoogleAuthenticator(oidcConfig, makeFetch({}));
    expect(auth.getProvider()).toBe('google');
  });

  it('authenticate returns ok principal', async () => {
    const fetch = makeFetch({ sub: '12345', email: 'g@google.com', name: 'G User' });
    const auth = new GoogleAuthenticator(oidcConfig, fetch);
    const result = await auth.authenticate('token');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().id).toBe('12345');
    expect(result.unwrap().roles).toEqual([]);
  });
});
