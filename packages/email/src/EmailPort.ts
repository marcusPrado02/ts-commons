import type { EmailMessage, SendEmailResult } from './EmailTypes';

/** Core port for email sending. All adapters must implement this interface. */
export interface EmailPort {
  /** Send a single email message. */
  send(message: EmailMessage): Promise<SendEmailResult>;
  /** Send multiple email messages. */
  sendBatch(messages: readonly EmailMessage[]): Promise<readonly SendEmailResult[]>;
  /** Check that the underlying transport is reachable. */
  checkHealth(): Promise<boolean>;
}
