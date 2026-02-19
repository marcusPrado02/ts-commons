/**
 * Thrown when an adapter does not support secret rotation.
 */
export class SecretsRotationNotSupportedError extends Error {
  constructor(adapterName: string) {
    super(`Secret rotation is not supported by "${adapterName}"`);
    this.name = 'SecretsRotationNotSupportedError';
  }
}
