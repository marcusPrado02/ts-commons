/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { CertificateValidator } from './CertificateValidator';
import { ClientCertAuthenticator } from './ClientCertAuthenticator';
import { CertRotationManager } from './CertRotationManager';
import { CertRevocationChecker } from './CertRevocationChecker';
import type { X509CertInfo, MtlsConnectionInfo } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCert(overrides: Partial<X509CertInfo> = {}): X509CertInfo {
  const now = new Date();
  return {
    subject: { CN: 'client.example.com', O: 'Acme' },
    issuer: { CN: 'ca.example.com' },
    serialNumber: 'abc123',
    notBefore: new Date(now.getTime() - 86400_000),
    notAfter: new Date(now.getTime() + 86400_000 * 365),
    fingerprint: 'sha256:AABBCC',
    ...overrides,
  };
}

// ─── CertificateValidator ─────────────────────────────────────────────────────

describe('CertificateValidator', () => {
  it('passes a valid certificate', () => {
    const v = new CertificateValidator();
    expect(v.validate(makeCert()).valid).toBe(true);
  });

  it('rejects an expired certificate', () => {
    const v = new CertificateValidator();
    const result = v.validate(makeCert({ notAfter: new Date(Date.now() - 1000) }));
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('rejects not yet valid certificate', () => {
    const v = new CertificateValidator();
    const result = v.validate(makeCert({ notBefore: new Date(Date.now() + 86400_000) }));
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not yet valid');
  });

  it('rejects subject not in allowedSubjects', () => {
    const v = new CertificateValidator({ allowedSubjects: ['trusted.example.com'] });
    const result = v.validate(makeCert());
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('allowedSubjects');
  });

  it('allows wildcard subject match', () => {
    const v = new CertificateValidator({ allowedSubjects: ['*.example.com'] });
    expect(v.validate(makeCert()).valid).toBe(true);
  });

  it('validates chain within depth limit', () => {
    const v = new CertificateValidator({ maxChainDepth: 3 });
    const chain = [makeCert(), makeCert(), makeCert()];
    expect(v.validateChain(chain).valid).toBe(true);
  });

  it('rejects chain exceeding depth limit', () => {
    const v = new CertificateValidator({ maxChainDepth: 2 });
    const chain = [makeCert(), makeCert(), makeCert()];
    const result = v.validateChain(chain);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('depth');
  });

  it('isExpiringSoon detects expiry within threshold', () => {
    const v = new CertificateValidator();
    const cert = makeCert({ notAfter: new Date(Date.now() + 86400_000 * 5) });
    expect(v.isExpiringSoon(cert, 30)).toBe(true);
    expect(v.isExpiringSoon(cert, 3)).toBe(false);
  });

  it('parseDN parses CN and O', () => {
    const dn = CertificateValidator.parseDN('CN=test,O=Acme,C=US');
    expect(dn['CN']).toBe('test');
    expect(dn['O']).toBe('Acme');
    expect(dn['C']).toBe('US');
  });
});

// ─── ClientCertAuthenticator ─────────────────────────────────────────────────

describe('ClientCertAuthenticator', () => {
  it('authenticates verified mTLS connection', () => {
    const auth = new ClientCertAuthenticator();
    const conn: MtlsConnectionInfo = { verified: true, peerCert: makeCert() };
    const result = auth.authenticate(conn);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().id).toBe('client.example.com');
  });

  it('rejects unverified connection', () => {
    const auth = new ClientCertAuthenticator();
    const conn: MtlsConnectionInfo = { verified: false };
    expect(auth.authenticate(conn).isErr()).toBe(true);
  });

  it('rejects expired peer cert', () => {
    const auth = new ClientCertAuthenticator();
    const conn: MtlsConnectionInfo = {
      verified: true,
      peerCert: makeCert({ notAfter: new Date(Date.now() - 1000) }),
    };
    expect(auth.authenticate(conn).isErr()).toBe(true);
  });

  it('authenticateCert returns principal from cert', () => {
    const auth = new ClientCertAuthenticator();
    const result = auth.authenticateCert(makeCert());
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().id).toBe('client.example.com');
  });

  it('falls back to serialNumber when no CN', () => {
    const auth = new ClientCertAuthenticator();
    const cert = makeCert({ subject: { O: 'Acme' } });
    const result = auth.authenticateCert(cert);
    expect(result.unwrap().id).toBe('abc123');
  });
});

// ─── CertRotationManager ─────────────────────────────────────────────────────

describe('CertRotationManager', () => {
  it('needsRotation=true when no cert installed', () => {
    const mgr = new CertRotationManager({ renewBeforeDays: 30, onRenew: async () => makeCert() });
    expect(mgr.needsRotation()).toBe(true);
  });

  it('needsRotation=false when cert is fresh', () => {
    const mgr = new CertRotationManager({ renewBeforeDays: 30, onRenew: async () => makeCert() });
    mgr.install(makeCert());
    expect(mgr.needsRotation()).toBe(false);
  });

  it('needsRotation=true when cert expiring soon', () => {
    const mgr = new CertRotationManager({ renewBeforeDays: 30, onRenew: async () => makeCert() });
    const expiringSoon = makeCert({ notAfter: new Date(Date.now() + 86400_000 * 10) });
    mgr.install(expiringSoon);
    expect(mgr.needsRotation()).toBe(true);
  });

  it('rotate calls onRenew and installs new cert', async () => {
    const newCert = makeCert({ subject: { CN: 'new.example.com' } });
    const onRenew = vi.fn().mockResolvedValue(newCert);
    const onRotated = vi.fn();
    const mgr = new CertRotationManager({ renewBeforeDays: 30, onRenew, onRotated });
    const result = await mgr.rotate();
    expect(result).toBe(newCert);
    expect(mgr.getCurrent()).toBe(newCert);
    expect(onRotated).toHaveBeenCalledWith(newCert);
  });
});

// ─── CertRevocationChecker ────────────────────────────────────────────────────

describe('CertRevocationChecker', () => {
  it('isRevoked returns false for non-revoked serial', () => {
    const checker = new CertRevocationChecker();
    expect(checker.isRevoked('serial1')).toBe(false);
  });

  it('isRevoked returns true after revoke()', () => {
    const checker = new CertRevocationChecker();
    checker.revoke('serial1', 'compromised');
    expect(checker.isRevoked('serial1')).toBe(true);
  });

  it('unrevoke removes from revoked set', () => {
    const checker = new CertRevocationChecker();
    checker.revoke('s1');
    checker.unrevoke('s1');
    expect(checker.isRevoked('s1')).toBe(false);
  });

  it('getEntry returns revocation details', () => {
    const checker = new CertRevocationChecker();
    checker.revoke('s2', 'keyCompromise');
    const entry = checker.getEntry('s2');
    expect(entry?.reason).toBe('keyCompromise');
    expect(entry?.serialNumber).toBe('s2');
  });

  it('loadCrl parses serial numbers from text', async () => {
    const crlText = 'serial-a\nserial-b\nserial-c\n';
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, text: async () => crlText });
    const checker = new CertRevocationChecker([], fetchFn);
    await checker.loadCrl('https://example.com/crl');
    expect(checker.isRevoked('serial-a')).toBe(true);
    expect(checker.isRevoked('serial-b')).toBe(true);
    expect(checker.revokedCount()).toBe(3);
  });

  it('loadCrl throws on fetch failure', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, text: async () => '' });
    const checker = new CertRevocationChecker([], fetchFn);
    await expect(checker.loadCrl('https://example.com/crl')).rejects.toThrow('CRL fetch failed');
  });

  it('checkPin returns true for pinned fingerprint', () => {
    expect(CertRevocationChecker.checkPin('sha256:AABB', ['sha256:AABB', 'sha256:CCDD'])).toBe(
      true,
    );
  });

  it('checkPin returns false for non-pinned fingerprint', () => {
    expect(CertRevocationChecker.checkPin('sha256:XXXX', ['sha256:AABB'])).toBe(false);
  });
});
