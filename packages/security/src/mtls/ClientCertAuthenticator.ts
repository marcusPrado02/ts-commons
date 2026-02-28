import type { AuthenticatedPrincipal } from '../authn/AuthenticatedPrincipal';
import { AuthError, InvalidTokenError } from '../authn/AuthErrors';
import { Result } from '@acme/kernel';
import { CertificateValidator } from './CertificateValidator';
import type { X509CertInfo, CertValidationOptions, MtlsConnectionInfo } from './types';

/**
 * Client certificate authenticator — extracts identity from mTLS peer certificate.
 */
export class ClientCertAuthenticator {
  private readonly validator: CertificateValidator;

  constructor(options?: CertValidationOptions) {
    this.validator = new CertificateValidator(options);
  }

  /**
   * Authenticate from a connection's peer certificate.
   */
  authenticate(connection: MtlsConnectionInfo): Result<AuthenticatedPrincipal, AuthError> {
    if (!connection.verified || connection.peerCert == null) {
      return Result.err(new InvalidTokenError());
    }

    const result = this.validator.validate(connection.peerCert);
    if (!result.valid) {
      return Result.err(new AuthError(result.reason ?? 'Certificate validation failed'));
    }

    const cn = connection.peerCert.subject['CN'] ?? connection.peerCert.serialNumber;
    return Result.ok<AuthenticatedPrincipal, AuthError>({
      id: cn,
      roles: [],
      permissions: [],
    });
  }

  /**
   * Authenticate from a parsed certificate directly (e.g., from TLS header).
   */
  authenticateCert(cert: X509CertInfo): Result<AuthenticatedPrincipal, AuthError> {
    const result = this.validator.validate(cert);
    if (!result.valid) {
      return Result.err(new AuthError(result.reason ?? 'Certificate validation failed'));
    }

    const cn = cert.subject['CN'] ?? cert.serialNumber;
    return Result.ok<AuthenticatedPrincipal, AuthError>({
      id: cn,
      roles: [],
      permissions: [],
    });
  }
}
