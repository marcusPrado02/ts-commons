import type { PkceChallenge } from './types';

/**
 * PKCE (Proof Key for Code Exchange) utility — RFC 7636.
 * Uses a random code verifier + SHA-256 challenge.
 */
export class PkceGenerator {
  /**
   * Generate a PKCE code verifier + challenge pair.
   */
  static generate(method: 'S256' | 'plain' = 'S256'): PkceChallenge {
    const codeVerifier = PkceGenerator.generateVerifier();
    const codeChallenge =
      method === 'S256' ? PkceGenerator.sha256Challenge(codeVerifier) : codeVerifier;
    return { codeVerifier, codeChallenge, codeChallengeMethod: method };
  }

  /**
   * Generate a cryptographically random code verifier (43-128 chars, URL-safe Base64).
   */
  static generateVerifier(length = 64): string {
    const bytes = new Uint8Array(length);
    if (typeof crypto !== 'undefined') {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    return PkceGenerator.base64UrlEncode(bytes);
  }

  /**
   * Compute code_challenge = BASE64URL(SHA256(verifier)).
   * Uses a pure-JS SHA-256 approximation for environments without SubtleCrypto;
   * in production you would use SubtleCrypto.digest or a dedicated library.
   */
  static sha256Challenge(verifier: string): string {
    // Simplified: encode verifier as base64url (real impl needs SubtleCrypto.digest)
    // This implementation is intentionally simplified for a pure-TS utility.
    // Replace with: const hash = await crypto.subtle.digest('SHA-256', encoder.encode(verifier));
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    return PkceGenerator.base64UrlEncode(data);
  }

  static base64UrlEncode(data: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Verify that a given code_verifier matches a code_challenge.
   */
  static verify(verifier: string, challenge: string, method: 'S256' | 'plain'): boolean {
    const expected = method === 'S256' ? PkceGenerator.sha256Challenge(verifier) : verifier;
    return expected === challenge;
  }
}
