import type { EventEnvelope } from '../envelope/EventEnvelope';

export interface EventPublisherPort {
  publish<T>(envelope: EventEnvelope<T>): Promise<void>;
  publishBatch<T>(envelopes: EventEnvelope<T>[]): Promise<void>;
}
