export interface X509CertInfo {
  readonly subject: Record<string, string>;
  readonly issuer: Record<string, string>;
  readonly serialNumber: string;
  readonly notBefore: Date;
  readonly notAfter: Date;
  readonly subjectAltNames?: string[];
  readonly fingerprint?: string;
  readonly pem?: string;
}

export interface CertValidationOptions {
  /** Trusted CA PEM certificate(s) */
  readonly trustedCAs?: string[];
  /** Check CRL endpoint */
  readonly checkCrl?: boolean;
  /** Check OCSP endpoint */
  readonly checkOcsp?: boolean;
  /** Allowed subject CN patterns */
  readonly allowedSubjects?: string[];
  /** Maximum certificate chain depth */
  readonly maxChainDepth?: number;
}

export interface CertValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
  readonly certInfo?: X509CertInfo;
}

export interface CertRotationPolicy {
  /** Days before expiry to trigger rotation */
  readonly renewBeforeDays: number;
  /** Generate new cert callback */
  onRenew: () => Promise<X509CertInfo>;
  /** Post-rotation hook */
  onRotated?: (newCert: X509CertInfo) => void;
}

export interface CertRevocationEntry {
  readonly serialNumber: string;
  readonly revokedAt: Date;
  readonly reason?: string;
}

export interface MtlsConnectionInfo {
  readonly peerCert?: X509CertInfo;
  readonly verified: boolean;
  readonly protocol?: string;
  readonly cipher?: string;
}
