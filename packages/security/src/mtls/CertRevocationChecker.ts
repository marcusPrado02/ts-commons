import type { CertRevocationEntry } from './types';

/**
 * CRL/OCSP revocation checker — in-memory revocation registry
 * with optional external CRL/OCSP fetch delegates.
 */

type FetchFn = (url: string) => Promise<{ ok: boolean; text: () => Promise<string> }>;

export class CertRevocationChecker {
  private readonly revoked = new Map<string, CertRevocationEntry>();

  constructor(
    private readonly crlUrls: string[] = [],
    private readonly fetch?: FetchFn,
  ) {}

  /**
   * Add a revocation entry directly (for in-memory / test use).
   */
  revoke(serial: string, reason?: string): void {
    this.revoked.set(serial, { serialNumber: serial, revokedAt: new Date(), reason });
  }

  /**
   * Un-revoke (for key rotation recovery scenarios).
   */
  unrevoke(serial: string): void {
    this.revoked.delete(serial);
  }

  /**
   * Check if a certificate serial number is revoked.
   */
  isRevoked(serial: string): boolean {
    return this.revoked.has(serial);
  }

  /**
   * Get revocation entry if present.
   */
  getEntry(serial: string): CertRevocationEntry | null {
    return this.revoked.get(serial) ?? null;
  }

  /**
   * Fetch and parse a CRL from URL (simplified — in production use a DER/PEM parser).
   * Here we expect a text format with one serial per line.
   */
  async loadCrl(url: string): Promise<void> {
    if (this.fetch == null) throw new Error('No fetch function provided for CRL loading');

    const response = await this.fetch(url);
    if (!response.ok) throw new Error(`CRL fetch failed: ${url}`);

    const text = await response.text();
    for (const line of text.split('\n')) {
      const serial = line.trim();
      if (serial.length > 0) {
        this.revoke(serial, 'CRL');
      }
    }
  }

  /**
   * Refresh all configured CRL URLs.
   */
  async refreshAll(): Promise<void> {
    for (const url of this.crlUrls) {
      await this.loadCrl(url);
    }
  }

  revokedCount(): number {
    return this.revoked.size;
  }

  /**
   * Certificate pinning: check if the certificate fingerprint matches pinned set.
   */
  static checkPin(fingerprint: string, pinnedFingerprints: string[]): boolean {
    return pinnedFingerprints.includes(fingerprint);
  }
}
