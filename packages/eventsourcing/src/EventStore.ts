/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { DomainEvent } from '@acme/kernel';

/**
 * A callback that handles a single domain event.
 */
export type EventHandler = (event: DomainEvent) => void;

/**
 * A function that cancels an event subscription.
 */
export type Unsubscribe = () => void;

/**
 * Raised when an `append` operation encounters a version mismatch,
 * indicating a concurrent write conflict.
 */
export class ConcurrencyError extends Error {
  constructor(streamId: string, expected: number, actual: number) {
    super(
      `Concurrency conflict on stream "${streamId}": expected version ${expected}, got ${actual}`,
    );
    this.name = 'ConcurrencyError';
  }
}

/**
 * Abstraction for an append-only event store.
 *
 * @example
 * ```ts
 * const store = new InMemoryEventStore();
 * await store.append('user-1', [new UserCreated(...)], 0);
 * const events = await store.getEvents('user-1');
 * ```
 */
export interface EventStore {
  /**
   * Appends events to the given stream.
   * Throws {@link ConcurrencyError} when `expectedVersion` doesn't match the
   * current stream length.
   */
  append(streamId: string, events: DomainEvent[], expectedVersion: number): Promise<void>;

  /**
   * Returns events from the stream, optionally starting from `fromVersion`
   * (0-based index).
   */
  getEvents(streamId: string, fromVersion?: number): Promise<DomainEvent[]>;

  /**
   * Subscribes to all future appends on any stream.
   * Returns an `Unsubscribe` callback to cancel the subscription.
   */
  subscribe(handler: EventHandler): Unsubscribe;
}

/**
 * In-memory implementation of {@link EventStore}, intended for testing
 * and local development.
 */
export class InMemoryEventStore implements EventStore {
  private readonly streams = new Map<string, DomainEvent[]>();
  private readonly handlers: EventHandler[] = [];

  append(streamId: string, events: DomainEvent[], expectedVersion: number): Promise<void> {
    const current = this.streams.get(streamId) ?? [];
    if (current.length !== expectedVersion) {
      return Promise.reject(new ConcurrencyError(streamId, expectedVersion, current.length));
    }
    const updated = [...current, ...events];
    this.streams.set(streamId, updated);
    for (const event of events) {
      for (const handler of this.handlers) {
        handler(event);
      }
    }
    return Promise.resolve();
  }

  getEvents(streamId: string, fromVersion = 0): Promise<DomainEvent[]> {
    const events = this.streams.get(streamId) ?? [];
    return Promise.resolve(events.slice(fromVersion));
  }

  subscribe(handler: EventHandler): Unsubscribe {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }
}
