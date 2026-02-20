/** Categories of events in an email's lifecycle. */
export type EmailEventType =
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'complained'
  | 'unsubscribed';

/** A single lifecycle event recorded for a sent message. */
export interface EmailTrackingEvent {
  readonly messageId: string;
  readonly event: EmailEventType;
  readonly timestamp: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Aggregated delivery statistics across all tracked messages. */
export interface EmailTrackingStats {
  readonly sent: number;
  readonly delivered: number;
  readonly opened: number;
  readonly clicked: number;
  readonly bounced: number;
  readonly complained: number;
  readonly unsubscribed: number;
}

/** Port for recording and querying email lifecycle events. */
export interface EmailTracker {
  record(event: EmailTrackingEvent): void;
  getEvents(messageId: string): readonly EmailTrackingEvent[];
  getAllEvents(): readonly EmailTrackingEvent[];
  getStats(): EmailTrackingStats;
  clear(): void;
}

/**
 * In-memory email tracker.
 *
 * Useful in tests to assert that the correct events were recorded
 * without needing a real webhook receiver.
 *
 * @example
 * ```ts
 * const tracker = new InMemoryEmailTracker();
 * tracker.record({ messageId: 'abc', event: 'sent', timestamp: new Date() });
 * const stats = tracker.getStats(); // { sent: 1, delivered: 0, ... }
 * ```
 */
export class InMemoryEmailTracker implements EmailTracker {
  private readonly events: EmailTrackingEvent[] = [];

  record(event: EmailTrackingEvent): void {
    this.events.push(event);
  }

  getEvents(messageId: string): readonly EmailTrackingEvent[] {
    return this.events.filter((e) => e.messageId === messageId);
  }

  getAllEvents(): readonly EmailTrackingEvent[] {
    return [...this.events];
  }

  getStats(): EmailTrackingStats {
    const count = (type: EmailEventType): number =>
      this.events.filter((e) => e.event === type).length;

    return {
      sent: count('sent'),
      delivered: count('delivered'),
      opened: count('opened'),
      clicked: count('clicked'),
      bounced: count('bounced'),
      complained: count('complained'),
      unsubscribed: count('unsubscribed'),
    };
  }

  clear(): void {
    this.events.length = 0;
  }
}
