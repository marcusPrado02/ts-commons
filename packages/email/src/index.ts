// Core port and types
export type { EmailPort } from './EmailPort';
export type { EmailAddress, EmailAttachment, EmailMessage, SendEmailResult } from './EmailTypes';

// Errors
export {
  EmailValidationError,
  EmailSendError,
  EmailProviderError,
  EmailAttachmentError,
} from './EmailErrors';

// Template engine
export type { EmailTemplate, EmailTemplateEngine, TemplateVariables } from './EmailTemplateEngine';
export { InMemoryTemplateEngine } from './EmailTemplateEngine';

// Tracking
export type {
  EmailEventType,
  EmailTrackingEvent,
  EmailTrackingStats,
  EmailTracker,
} from './EmailTracker';
export { InMemoryEmailTracker } from './EmailTracker';

// Adapters — in-memory & logging (no external deps)
export { InMemoryEmailAdapter } from './InMemoryEmailAdapter';
export { LoggingEmailAdapter } from './LoggingEmailAdapter';

// Adapter — SMTP (nodemailer-compatible)
export type {
  SmtpClientLike,
  SmtpSendMailParams,
  SmtpSendMailResult,
  SmtpAttachment,
} from './SmtpEmailAdapter';
export { SmtpEmailAdapter } from './SmtpEmailAdapter';

// Adapter — SendGrid
export type { SendGridClientLike, SendGridMessage, SendGridResponse } from './SendGridEmailAdapter';
export { SendGridEmailAdapter } from './SendGridEmailAdapter';

// Adapter — Mailgun
export type { MailgunClientLike, MailgunMessageData, MailgunResponse } from './MailgunEmailAdapter';
export { MailgunEmailAdapter } from './MailgunEmailAdapter';

// Adapter — AWS SES v2
export type { SesClientLike, SesSendEmailParams, SesSendEmailResult } from './SesEmailAdapter';
export { SesEmailAdapter } from './SesEmailAdapter';
