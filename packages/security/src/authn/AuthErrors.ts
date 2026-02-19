/**
 * Authentication error hierarchy.
 *
 * Use `instanceof AuthError` to catch any authentication failure, or catch
 * specific sub-classes for fine-grained handling.
 */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Thrown when a token is structurally invalid, has a bad signature, or
 * cannot be parsed.
 */
export class InvalidTokenError extends AuthError {
  constructor() {
    super('Invalid or malformed authentication token');
    this.name = 'InvalidTokenError';
  }
}

/**
 * Thrown when a token was valid but its `exp` claim is in the past.
 */
export class ExpiredTokenError extends AuthError {
  constructor() {
    super('Authentication token has expired');
    this.name = 'ExpiredTokenError';
  }
}
