/**
 * PII (Personally Identifiable Information) redactor.
 */
export class PiiRedactor {
  private static readonly PII_FIELDS = new Set([
    'password',
    'ssn',
    'creditCard',
    'email',
    'phone',
    'address',
  ]);

  static redact(data: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (this.PII_FIELDS.has(key)) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = this.redact(value as Record<string, unknown>);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }
}
