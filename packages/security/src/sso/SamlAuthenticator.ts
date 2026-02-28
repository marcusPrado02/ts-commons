import { Result } from '@acme/kernel';
import type { AuthenticatedPrincipal } from '../authn/AuthenticatedPrincipal';
import { AuthError, InvalidTokenError } from '../authn/AuthErrors';
import type { SamlAssertion, SamlConfig } from './types';

/**
 * SAML 2.0 integration — parses SAML assertions and maps to AuthenticatedPrincipal.
 * Full XML signing/encryption is out of scope; this provides the assertion parsing layer.
 */
export class SamlAuthenticator {
  constructor(private readonly config: SamlConfig) {}

  getProvider(): string {
    return 'saml2';
  }

  /**
   * Parse a SAML assertion (assumed already signature-verified) into principal.
   */
  fromAssertion(assertion: SamlAssertion): Result<AuthenticatedPrincipal, AuthError> {
    if (!assertion.nameId) {
      return Result.err(new InvalidTokenError());
    }

    // Validate time conditions
    if (assertion.conditions?.notOnOrAfter != null) {
      if (new Date() > new Date(assertion.conditions.notOnOrAfter)) {
        return Result.err(new AuthError('SAML assertion has expired'));
      }
    }
    if (assertion.conditions?.notBefore != null) {
      if (new Date() < new Date(assertion.conditions.notBefore)) {
        return Result.err(new AuthError('SAML assertion not yet valid'));
      }
    }

    const roles = this.extractRoles(assertion);
    const tenantId = this.extractString(assertion.attributes, 'tenantId');

    return Result.ok<AuthenticatedPrincipal, AuthError>({
      id: assertion.nameId,
      ...(tenantId === undefined ? {} : { tenantId }),
      roles,
      permissions: [],
    });
  }

  /**
   * Build an authentication request URL to redirect the user to the IdP.
   */
  buildAuthRequestUrl(relayState?: string): string {
    const params = new URLSearchParams({
      SAMLRequest: this.buildSamlRequest(),
      SigAlg: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    });
    if (relayState != null) params.set('RelayState', relayState);
    return `${this.config.idpSsoUrl}?${params.toString()}`;
  }

  private buildSamlRequest(): string {
    // Simplified XML — production would use a full SAML library
    const id = `_${Math.random().toString(36).slice(2)}`;
    const now = new Date().toISOString();
    const xml = `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="${id}" Version="2.0" IssueInstant="${now}" AssertionConsumerServiceURL="${this.config.spAcsUrl}" Destination="${this.config.idpSsoUrl}"><saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${this.config.spEntityId}</saml:Issuer></samlp:AuthnRequest>`;
    return Buffer.from(xml).toString('base64');
  }

  private extractRoles(assertion: SamlAssertion): string[] {
    const raw =
      assertion.attributes['roles'] ??
      assertion.attributes['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') return [raw];
    return [];
  }

  private extractString(attrs: Record<string, string | string[]>, key: string): string | undefined {
    const val = attrs[key];
    if (typeof val === 'string') return val;
    if (Array.isArray(val) && val.length > 0) return val[0];
    return undefined;
  }
}
