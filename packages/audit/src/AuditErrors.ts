/**
 * Thrown when the audit storage backend fails to persist or read entries.
 */
export class AuditStorageError extends Error {
  override readonly name = 'AuditStorageError';

  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}

/**
 * Thrown when an audit query contains invalid parameters.
 */
export class AuditQueryError extends Error {
  override readonly name = 'AuditQueryError';

  constructor(reason: string) {
    super(`Invalid audit query: ${reason}`);
  }
}

/**
 * Thrown when the audit service is misconfigured (e.g. missing storage).
 */
export class AuditConfigError extends Error {
  override readonly name = 'AuditConfigError';

  constructor(reason: string) {
    super(`Audit configuration error: ${reason}`);
  }
}
