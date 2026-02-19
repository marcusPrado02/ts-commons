import type { EventEnvelope } from '@acme/messaging';

let eventCounter = 0;

/**
 * Factory helpers for building {@link EventEnvelope} test fixtures.
 */
export const EventEnvelopeFixture = {
  /**
   * Creates a single {@link EventEnvelope} with sensible defaults.
   * Each call generates a unique `eventId` by default.
   */
  create(overrides?: Partial<EventEnvelope>): EventEnvelope {
    eventCounter += 1;
    return {
      eventId: `evt-test-${eventCounter}`,
      eventType: 'test.event.occurred',
      eventVersion: '1.0',
      timestamp: new Date().toISOString(),
      payload: { fixture: true },
      ...overrides,
    };
  },

  /**
   * Creates a batch of `count` envelopes, each with its own unique `eventId`.
   */
  createBatch(count: number, overrides?: Partial<EventEnvelope>): EventEnvelope[] {
    return Array.from({ length: count }, () => EventEnvelopeFixture.create(overrides));
  },

  /** Resets the internal counter — call in `beforeEach` for deterministic ids. */
  reset(): void {
    eventCounter = 0;
  },
};
