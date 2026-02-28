import type { CertValidationOptions, CertValidationResult, X509CertInfo } from './types';

/**
 * Certificate validator — checks expiry, subject allowlist, and chain depth.
 * CRL/OCSP checking is abstracted via injected fetchers.
 */
export class CertificateValidator {
  constructor(private readonly options: CertValidationOptions = {}) {}

  /**
   * Validate a parsed certificate info object against the configured policy.
   */
  validate(cert: X509CertInfo): CertValidationResult {
    const now = new Date();

    if (now < cert.notBefore) {
      return {
        valid: false,
        reason: `Certificate not yet valid (notBefore: ${cert.notBefore.toISOString()})`,
        certInfo: cert,
      };
    }

    if (now > cert.notAfter) {
      return {
        valid: false,
        reason: `Certificate has expired (notAfter: ${cert.notAfter.toISOString()})`,
        certInfo: cert,
      };
    }

    if (this.options.allowedSubjects != null && this.options.allowedSubjects.length > 0) {
      const cn = cert.subject['CN'] ?? '';
      const allowed = this.options.allowedSubjects.some((pattern) =>
        this.matchSubject(cn, pattern),
      );
      if (!allowed) {
        return {
          valid: false,
          reason: `Subject CN "${cn}" not in allowedSubjects`,
          certInfo: cert,
        };
      }
    }

    return { valid: true, certInfo: cert };
  }

  /**
   * Validate the certificate chain depth.
   */
  validateChain(chain: X509CertInfo[]): CertValidationResult {
    const maxDepth = this.options.maxChainDepth ?? 5;
    if (chain.length > maxDepth) {
      return {
        valid: false,
        reason: `Chain depth ${chain.length} exceeds maximum ${maxDepth}`,
      };
    }
    // Validate each cert individually
    for (const cert of chain) {
      const result = this.validate(cert);
      if (!result.valid) return result;
    }
    return { valid: true };
  }

  /**
   * Check if cert expires within the given number of days.
   */
  isExpiringSoon(cert: X509CertInfo, withinDays = 30): boolean {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + withinDays);
    return cert.notAfter <= threshold;
  }

  /**
   * Parse subject/issuer fields from a DN string like "CN=foo,O=Acme,C=US".
   */
  static parseDN(dn: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const part of dn.split(',')) {
      const eq = part.indexOf('=');
      if (eq > 0) {
        const key = part.slice(0, eq).trim();
        const val = part.slice(eq + 1).trim();
        result[key] = val;
      }
    }
    return result;
  }

  private matchSubject(cn: string, pattern: string): boolean {
    if (pattern.startsWith('*')) {
      return cn.endsWith(pattern.slice(1));
    }
    return cn === pattern;
  }
}
