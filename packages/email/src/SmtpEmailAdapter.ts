import { EmailSendError } from './EmailErrors';
import type { EmailPort } from './EmailPort';
import type { EmailAddress, EmailAttachment, EmailMessage, SendEmailResult } from './EmailTypes';

// ---------------------------------------------------------------------------
// Client-like interface (mirrors nodemailer's transport shape)
// ---------------------------------------------------------------------------

export interface SmtpAttachment {
  readonly filename: string;
  readonly content: string | Uint8Array;
  readonly contentType: string;
  readonly cid?: string;
}

export interface SmtpSendMailParams {
  readonly from: string;
  readonly to: string;
  readonly cc?: string;
  readonly bcc?: string;
  readonly replyTo?: string;
  readonly subject: string;
  readonly text?: string;
  readonly html?: string;
  readonly headers?: Record<string, string>;
  readonly attachments?: readonly SmtpAttachment[];
}

export interface SmtpSendMailResult {
  readonly messageId: string;
  readonly accepted: readonly string[];
  readonly rejected: readonly string[];
}

/** Minimal interface for an SMTP transport (e.g. nodemailer's `createTransport()`). */
export interface SmtpClientLike {
  sendMail(params: SmtpSendMailParams): Promise<SmtpSendMailResult>;
  verify(): Promise<boolean>;
  close(): void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAddress(a: EmailAddress): string {
  return a.name !== undefined ? `"${a.name}" <${a.email}>` : a.email;
}

function toSmtpAttachment(a: EmailAttachment): SmtpAttachment {
  return {
    filename: a.filename,
    content: a.content,
    contentType: a.contentType,
    ...(a.contentId !== undefined && { cid: a.contentId }),
  };
}

function buildSmtpAddressFields(message: EmailMessage): {
  cc?: string;
  bcc?: string;
  replyTo?: string;
} {
  return {
    ...(message.cc !== undefined &&
      message.cc.length > 0 && { cc: message.cc.map(formatAddress).join(', ') }),
    ...(message.bcc !== undefined &&
      message.bcc.length > 0 && { bcc: message.bcc.map(formatAddress).join(', ') }),
    ...(message.replyTo !== undefined && { replyTo: formatAddress(message.replyTo) }),
  };
}

function buildSmtpBodyFields(message: EmailMessage): {
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  attachments?: SmtpAttachment[];
} {
  return {
    ...(message.text !== undefined && { text: message.text }),
    ...(message.html !== undefined && { html: message.html }),
    ...(message.headers !== undefined && { headers: { ...message.headers } }),
    ...(message.attachments !== undefined &&
      message.attachments.length > 0 && {
        attachments: message.attachments.map(toSmtpAttachment),
      }),
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Email adapter backed by any SMTP client implementing {@link SmtpClientLike}.
 *
 * Designed for use with nodemailer — inject a `createTransport(...)` result.
 *
 * @example
 * ```ts
 * import nodemailer from 'nodemailer';
 * const transport = nodemailer.createTransport({ host: 'smtp.example.com', port: 587 });
 * const mailer = new SmtpEmailAdapter(transport);
 * ```
 */
export class SmtpEmailAdapter implements EmailPort {
  constructor(private readonly client: SmtpClientLike) {}

  async send(message: EmailMessage): Promise<SendEmailResult> {
    const params: SmtpSendMailParams = {
      from: formatAddress(message.from),
      to: message.to.map(formatAddress).join(', '),
      subject: message.subject,
      ...buildSmtpAddressFields(message),
      ...buildSmtpBodyFields(message),
    };

    try {
      const result = await this.client.sendMail(params);
      return {
        messageId: result.messageId,
        provider: 'smtp',
        accepted: result.accepted,
        rejected: result.rejected,
        timestamp: new Date(),
      };
    } catch (err) {
      throw new EmailSendError('smtp', err instanceof Error ? err.message : String(err));
    }
  }

  async sendBatch(messages: readonly EmailMessage[]): Promise<readonly SendEmailResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async checkHealth(): Promise<boolean> {
    try {
      return await this.client.verify();
    } catch {
      return false;
    }
  }
}
