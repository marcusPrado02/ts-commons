/* eslint-disable @typescript-eslint/explicit-function-return-type -- test helper functions */
/* eslint-disable max-lines-per-function -- test files naturally have longer functions */
/**
 * Tests for @acme/security — Crypto utilities (Item 19)
 *
 * AesGcmCipher · Sha256Hasher · HmacSha256Signer · PiiMasker
 */
import { describe, it, expect } from 'vitest';
import { AesGcmCipher } from './crypto/AesGcmCipher';
import { Sha256Hasher } from './crypto/Sha256Hasher';
import { HmacSha256Signer } from './crypto/HmacSha256Signer';
import { PiiMasker } from './crypto/PiiMasker';

// ---------------------------------------------------------------------------
// AesGcmCipher
// ---------------------------------------------------------------------------

describe('AesGcmCipher', () => {
  const cipher  = new AesGcmCipher();
  const KEY     = 'test-encryption-key';
  const MESSAGE = 'Hello, secret world!';

  it('encrypt returns a CipherResult with non-empty hex ciphertext, iv, and tag', () => {
    const result = cipher.encrypt(MESSAGE, KEY);

    expect(result.ciphertext).toMatch(/^[0-9a-f]+$/u);
    expect(result.iv).toMatch(/^[0-9a-f]{24}$/u);  // 12 bytes → 24 hex chars
    expect(result.tag).toMatch(/^[0-9a-f]{32}$/u);  // 16 bytes → 32 hex chars
    expect(result.ciphertext.length).toBeGreaterThan(0);
  });

  it('decrypt(encrypt(message, key), key) returns the original plaintext', () => {
    const result = cipher.encrypt(MESSAGE, KEY);

    expect(cipher.decrypt(result, KEY)).toBe(MESSAGE);
  });

  it('two encrypt calls on the same message produce different IVs', () => {
    const r1 = cipher.encrypt(MESSAGE, KEY);
    const r2 = cipher.encrypt(MESSAGE, KEY);

    // Random IV means ciphertexts differ even for identical plaintexts
    expect(r1.iv).not.toBe(r2.iv);
    expect(r1.ciphertext).not.toBe(r2.ciphertext);
  });

  it('decrypt throws when the wrong key is used', () => {
    const result = cipher.encrypt(MESSAGE, KEY);

    expect(() => cipher.decrypt(result, 'wrong-key')).toThrow();
  });

  it('decrypt throws when the auth tag has been tampered', () => {
    const result = cipher.encrypt(MESSAGE, KEY);
    // Flip the first byte of the tag (XOR with 0xff → different hex)
    const tamperedTag = 'ff' + result.tag.slice(2);
    const tampered    = { ...result, tag: tamperedTag };

    expect(() => cipher.decrypt(tampered, KEY)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Sha256Hasher
// ---------------------------------------------------------------------------

describe('Sha256Hasher', () => {
  const hasher = new Sha256Hasher();

  it('hash returns a 64-character lowercase hex string', () => {
    const digest = hasher.hash('hello');

    expect(digest).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('hash is deterministic — same input always yields the same digest', () => {
    expect(hasher.hash('deterministic')).toBe(hasher.hash('deterministic'));
  });

  it('different inputs produce different digests', () => {
    expect(hasher.hash('abc')).not.toBe(hasher.hash('abd'));
  });

  it('hash of the empty string equals the well-known SHA-256 value', () => {
    // SHA-256('') = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(hasher.hash('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

// ---------------------------------------------------------------------------
// HmacSha256Signer
// ---------------------------------------------------------------------------

describe('HmacSha256Signer', () => {
  const signer  = new HmacSha256Signer();
  const DATA    = 'payload data';
  const KEY     = 'hmac-secret-key';

  it('sign returns a 64-character lowercase hex string', () => {
    expect(signer.sign(DATA, KEY)).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('verify returns true for the correct data, key, and signature', () => {
    const sig = signer.sign(DATA, KEY);

    expect(signer.verify(DATA, KEY, sig)).toBe(true);
  });

  it('verify returns false when the wrong key is used', () => {
    const sig = signer.sign(DATA, KEY);

    expect(signer.verify(DATA, 'wrong-key', sig)).toBe(false);
  });

  it('verify returns false when the data has been tampered', () => {
    const sig = signer.sign(DATA, KEY);

    expect(signer.verify('tampered data', KEY, sig)).toBe(false);
  });

  it('sign is deterministic — same data and key always yield the same signature', () => {
    expect(signer.sign(DATA, KEY)).toBe(signer.sign(DATA, KEY));
  });
});

// ---------------------------------------------------------------------------
// PiiMasker
// ---------------------------------------------------------------------------

describe('PiiMasker', () => {
  const masker = new PiiMasker();

  it('masks the entire value by default (no options)', () => {
    expect(masker.mask('secret')).toBe('******');
  });

  it('visibleSuffix leaves the last N characters unmasked', () => {
    // Mask a credit-card-like string, show only last 4 digits
    expect(masker.mask('4111111111111111', { visibleSuffix: 4 })).toBe('************1111');
  });

  it('visiblePrefix leaves the first N characters unmasked', () => {
    expect(masker.mask('user@example.com', { visiblePrefix: 4 })).toBe('user************');
  });

  it('visiblePrefix + visibleSuffix combo shows both ends', () => {
    // '+1-800-555-0100' → 15 chars; 15 - 3 prefix - 4 suffix = 8 mask chars
    expect(masker.mask('+1-800-555-0100', { visiblePrefix: 3, visibleSuffix: 4 })).toBe(
      '+1-********0100',
    );
  });

  it('custom maskChar replaces the default asterisk', () => {
    expect(masker.mask('secret', { maskChar: '#' })).toBe('######');
  });
});
