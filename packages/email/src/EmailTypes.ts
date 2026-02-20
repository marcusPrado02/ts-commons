/** An email address with an optional display name. */
export interface EmailAddress {
  readonly email: string;
  readonly name?: string;
}

/** A file to attach to an email. */
export interface EmailAttachment {
  readonly filename: string;
  /** UTF-8 string or raw binary buffer. */
  readonly content: string | Uint8Array;
  readonly contentType: string;
  /** Content-ID for inline (cid:) attachments. */
  readonly contentId?: string;
  readonly disposition?: 'attachment' | 'inline';
}

/** Represents a fully formed sendable email message. */
export interface EmailMessage {
  readonly from: EmailAddress;
  readonly to: readonly EmailAddress[];
  readonly cc?: readonly EmailAddress[];
  readonly bcc?: readonly EmailAddress[];
  readonly replyTo?: EmailAddress;
  readonly subject: string;
  /** Plain-text body. */
  readonly text?: string;
  /** HTML body. */
  readonly html?: string;
  readonly attachments?: readonly EmailAttachment[];
  /** Extra transport headers. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Provider-specific tags / categories for tracking. */
  readonly tags?: readonly string[];
}

/** Result returned after a successful send attempt. */
export interface SendEmailResult {
  readonly messageId: string;
  readonly provider: string;
  readonly accepted: readonly string[];
  readonly rejected: readonly string[];
  readonly timestamp: Date;
}
