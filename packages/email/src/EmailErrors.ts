/** Thrown when the email message itself is structurally invalid. */
export class EmailValidationError extends Error {
  readonly field: string;

  constructor(field: string, reason: string) {
    super(`Email validation failed on '${field}': ${reason}`);
    this.name = 'EmailValidationError';
    this.field = field;
  }
}

/** Thrown when the provider reports a non-retryable send failure. */
export class EmailSendError extends Error {
  readonly provider: string;
  readonly statusCode: number | undefined;

  constructor(provider: string, message: string, statusCode?: number) {
    super(`[${provider}] Send failed: ${message}`);
    this.name = 'EmailSendError';
    this.provider = provider;
    this.statusCode = statusCode;
  }
}

/** Thrown when the transport/provider encounters a fatal error (e.g. auth failure). */
export class EmailProviderError extends Error {
  readonly provider: string;

  constructor(provider: string, message: string) {
    super(`[${provider}] Provider error: ${message}`);
    this.name = 'EmailProviderError';
    this.provider = provider;
  }
}

/** Thrown when an attachment cannot be processed. */
export class EmailAttachmentError extends Error {
  readonly filename: string;

  constructor(filename: string, reason: string) {
    super(`Attachment '${filename}' error: ${reason}`);
    this.name = 'EmailAttachmentError';
    this.filename = filename;
  }
}
