/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { FieldEncryption } from './FieldEncryption';
import { EnvelopeEncryption } from './EnvelopeEncryption';
import { KeyRotationManager } from './KeyRotationManager';
import { KmsClient } from './KmsClient';

// ──────────────────────────────────────────────────────────────────────────────
// FieldEncryption
// ──────────────────────────────────────────────────────────────────────────────

describe('FieldEncryption', () => {
  const key = randomBytes(32);

  it('encrypts and decrypts a string roundtrip', () => {
    const enc = new FieldEncryption(key);
    const encrypted = enc.encrypt('hello world');
    expect(enc.decrypt(encrypted)).toBe('hello world');
  });

  it('produces different ciphertexts for same plaintext (IV randomness)', () => {
    const enc = new FieldEncryption(key);
    const a = enc.encrypt('same');
    const b = enc.encrypt('same');
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('encrypted value has algorithm field', () => {
    const enc = new FieldEncryption(key);
    expect(enc.encrypt('test').algorithm).toBe('aes-256-gcm');
  });

  it('encrypts/decrypts an object roundtrip', () => {
    const enc = new FieldEncryption(key);
    const obj = { name: 'Alice', age: 30 };
    const encrypted = enc.encryptObject(obj);
    expect(enc.decryptObject(encrypted)).toEqual(obj);
  });

  it('works with passphrase + salt', () => {
    const enc = new FieldEncryption('my-passphrase', 'my-salt');
    const encrypted = enc.encrypt('secret');
    expect(enc.decrypt(encrypted)).toBe('secret');
  });

  it('throws on wrong key size (Buffer)', () => {
    expect(() => new FieldEncryption(randomBytes(16))).toThrow();
  });

  it('ciphertext is a base64 string', () => {
    const enc = new FieldEncryption(key);
    const { ciphertext } = enc.encrypt('test');
    expect(() => Buffer.from(ciphertext, 'base64')).not.toThrow();
  });

  it('decryption fails with tampered ciphertext', () => {
    const enc = new FieldEncryption(key);
    const encrypted = enc.encrypt('hello');
    // Flip a byte in the middle of the base64 payload
    const buf = Buffer.from(encrypted.ciphertext, 'base64');
    buf[15] = (buf[15] ?? 0) ^ 0xff; // flip auth tag byte
    const tampered = { ...encrypted, ciphertext: buf.toString('base64') };
    expect(() => enc.decrypt(tampered)).toThrow();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// EnvelopeEncryption
// ──────────────────────────────────────────────────────────────────────────────

describe('EnvelopeEncryption', () => {
  const masterKey = randomBytes(32);

  it('encrypts and decrypts a message', () => {
    const env = new EnvelopeEncryption(masterKey);
    const enveloped = env.encrypt('confidential data');
    expect(env.decrypt(enveloped)).toBe('confidential data');
  });

  it('produces different encryptedDataKey per call', () => {
    const env = new EnvelopeEncryption(masterKey);
    const a = env.encrypt('msg');
    const b = env.encrypt('msg');
    expect(a.encryptedDataKey).not.toBe(b.encryptedDataKey);
  });

  it('stores masterKeyId when provided', () => {
    const env = new EnvelopeEncryption(masterKey, 'mk1');
    const enveloped = env.encrypt('test');
    expect(enveloped.masterKeyId).toBe('mk1');
  });

  it('works with passphrase master key', () => {
    const env = new EnvelopeEncryption('master-passphrase');
    const enveloped = env.encrypt('hello');
    expect(env.decrypt(enveloped)).toBe('hello');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// KeyRotationManager
// ──────────────────────────────────────────────────────────────────────────────

describe('KeyRotationManager', () => {
  it('starts with one key', () => {
    const mgr = new KeyRotationManager();
    expect(mgr.keyCount).toBe(1);
  });

  it('getActiveEncryption encrypts/decrypts', () => {
    const mgr = new KeyRotationManager();
    const enc = mgr.getActiveEncryption();
    const v = enc.encrypt('data');
    expect(enc.decrypt(v)).toBe('data');
  });

  it('rotate adds new key and changes active', () => {
    const mgr = new KeyRotationManager();
    const oldId = mgr.activeKey;
    mgr.rotate();
    expect(mgr.keyCount).toBe(2);
    expect(mgr.activeKey).not.toBe(oldId);
  });

  it('old key still decrypts data encrypted before rotation', () => {
    const mgr = new KeyRotationManager();
    const oldKeyId = mgr.activeKey;
    const enc = mgr.getActiveEncryption();
    const v = enc.encrypt('legacy');
    mgr.rotate();
    const oldEnc = mgr.getEncryptionForKey(oldKeyId);
    expect(oldEnc?.decrypt(v)).toBe('legacy');
  });

  it('getEncryptionForKey returns null for unknown id', () => {
    const mgr = new KeyRotationManager();
    expect(mgr.getEncryptionForKey('unknown')).toBeNull();
  });

  it('getHistory records rotation events', () => {
    const mgr = new KeyRotationManager();
    mgr.rotate();
    mgr.rotate();
    expect(mgr.getHistory().length).toBe(2);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// KmsClient
// ──────────────────────────────────────────────────────────────────────────────

function makeKmsClient() {
  const encryptFn = vi.fn(async (plaintext: string) => `enc:${plaintext}`);
  const decryptFn = vi.fn(async (ciphertext: string) => ciphertext.replace('enc:', ''));
  const client = KmsClient.fromFunctions(
    { provider: 'aws', keyId: 'arn:aws:kms:us-east-1:123:key/abc' },
    encryptFn,
    decryptFn,
  );
  return { client, encryptFn, decryptFn };
}

describe('KmsClient', () => {
  it('encrypts via adapter', async () => {
    const { client } = makeKmsClient();
    const result = await client.encrypt('secret');
    expect(result).toBe('enc:secret');
  });

  it('decrypts via adapter', async () => {
    const { client } = makeKmsClient();
    const result = await client.decrypt('enc:secret');
    expect(result).toBe('secret');
  });

  it('exposes provider and keyId', () => {
    const { client } = makeKmsClient();
    expect(client.provider).toBe('aws');
    expect(client.keyId).toContain('abc');
  });
});
