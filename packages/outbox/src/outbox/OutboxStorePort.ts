import type { EventEnvelope } from '@acme/messaging';

export interface OutboxMessage {
  readonly id: string;
  readonly eventEnvelope: EventEnvelope;
  readonly createdAt: Date;
  readonly publishedAt?: Date;
  readonly attempts: number;
  readonly lastAttemptAt?: Date;
  readonly error?: string;
}

export interface OutboxStorePort {
  save(message: OutboxMessage): Promise<void>;
  getUnpublished(limit: number): Promise<OutboxMessage[]>;
  markAsPublished(id: string): Promise<void>;
  markAsFailed(id: string, error: string): Promise<void>;
}
