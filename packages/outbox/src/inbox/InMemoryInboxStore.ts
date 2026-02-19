import type { InboxMessage, InboxStorePort } from './InboxStorePort';

/**
 * In-memory implementation of {@link InboxStorePort}.
 * Provides duplicate detection via a `Set` of processed event IDs.
 */
export class InMemoryInboxStore implements InboxStorePort {
  private readonly messages = new Map<string, InboxMessage>();
  private readonly seenEventIds = new Set<string>();

  isDuplicate(eventId: string): Promise<boolean> {
    return Promise.resolve(this.seenEventIds.has(eventId));
  }

  save(message: InboxMessage): Promise<void> {
    this.seenEventIds.add(message.eventEnvelope.eventId);
    this.messages.set(message.id, message);
    return Promise.resolve();
  }

  markAsProcessed(id: string): Promise<void> {
    const msg = this.messages.get(id);
    if (msg !== undefined) {
      this.messages.set(id, { ...msg, processedAt: new Date() });
    }
    return Promise.resolve();
  }

  /** Returns all messages (for inspection in tests). */
  getAll(): InboxMessage[] {
    return Array.from(this.messages.values());
  }

  /** Returns the number of stored messages. */
  size(): number {
    return this.messages.size;
  }
}
