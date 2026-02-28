import { randomBytes } from 'node:crypto';

/**
 * CSP nonce generator — creates a cryptographically secure nonce per request.
 * Each call returns a new, unique base64-encoded nonce.
 */
export class NonceGenerator {
  private readonly byteLength: number;

  constructor(byteLength = 16) {
    this.byteLength = byteLength;
  }

  /** Generate a fresh base64url nonce. */
  generate(): string {
    return randomBytes(this.byteLength).toString('base64url');
  }

  /** Format as a CSP nonce source value: 'nonce-<value>' */
  formatSource(nonce: string): string {
    return `'nonce-${nonce}'`;
  }

  /** Generate and return both the raw nonce and its CSP source string. */
  generatePair(): { nonce: string; source: string } {
    const nonce = this.generate();
    return { nonce, source: this.formatSource(nonce) };
  }
}
