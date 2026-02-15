import type { EventEnvelope } from '../envelope/EventEnvelope';

export interface EventHandler<T = unknown> {
  handle(envelope: EventEnvelope<T>): Promise<void>;
}

export interface EventConsumer {
  subscribe<T>(eventType: string, handler: EventHandler<T>): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}
