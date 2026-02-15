import type { EventEnvelope } from '@acme/messaging';

export interface InboxMessage {
  readonly id: string;
  readonly eventEnvelope: EventEnvelope;
  readonly receivedAt: Date;
  readonly processedAt?: Date;
}

export interface InboxStorePort {
  isDuplicate(eventId: string): Promise<boolean>;
  save(message: InboxMessage): Promise<void>;
  markAsProcessed(id: string): Promise<void>;
}
