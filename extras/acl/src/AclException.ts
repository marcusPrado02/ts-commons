/**
 * A structured exception thrown by the Anti-Corruption Layer when a legacy
 * operation fails.  Extends `Error` so it can be thrown safely.
 */
export class AclException extends Error {
  readonly code: string;
  readonly originalError: unknown;

  constructor(code: string, message: string, originalError: unknown) {
    super(message);
    this.name = 'AclException';
    this.code = code;
    this.originalError = originalError;
  }
}
