import type { X509CertInfo, CertRotationPolicy } from './types';
import { CertificateValidator } from './CertificateValidator';

/**
 * Certificate rotation manager — monitors expiry and triggers renewal.
 */
export class CertRotationManager {
  private currentCert: X509CertInfo | null = null;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private readonly validator: CertificateValidator;

  constructor(private readonly policy: CertRotationPolicy) {
    this.validator = new CertificateValidator();
  }

  /**
   * Install a certificate as the current active cert.
   */
  install(cert: X509CertInfo): void {
    this.currentCert = cert;
  }

  /**
   * Returns the current active certificate.
   */
  getCurrent(): X509CertInfo | null {
    return this.currentCert;
  }

  /**
   * Check if the current cert needs rotation (expiring within renewBeforeDays).
   */
  needsRotation(): boolean {
    if (this.currentCert == null) return true;
    return this.validator.isExpiringSoon(this.currentCert, this.policy.renewBeforeDays);
  }

  /**
   * Trigger rotation: generate a new cert and install it.
   */
  async rotate(): Promise<X509CertInfo> {
    const newCert = await this.policy.onRenew();
    this.currentCert = newCert;
    if (this.policy.onRotated != null) {
      this.policy.onRotated(newCert);
    }
    return newCert;
  }

  /**
   * Start a periodic check that auto-rotates when needed.
   * @param intervalMs - how often to check (default: 1 hour)
   */
  startAutoRotation(intervalMs = 3_600_000): void {
    this.stopAutoRotation();
    this.checkTimer = setInterval(() => {
      if (this.needsRotation()) {
        void this.rotate();
      }
    }, intervalMs);
  }

  stopAutoRotation(): void {
    if (this.checkTimer != null) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }
}
