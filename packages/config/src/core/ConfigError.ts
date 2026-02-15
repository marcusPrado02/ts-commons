/**
 * Error thrown when configuration is invalid.
 */
export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly validationErrors: string[],
  ) {
    super(`${message}: ${validationErrors.join(', ')}`);
    this.name = 'ConfigError';
  }
}
