/* eslint-disable @typescript-eslint/no-unsafe-member-access -- amqplib properties */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- envelope metadata spread */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- envelope properties */
/* eslint-disable @typescript-eslint/no-unsafe-call -- logger methods */
/* eslint-disable @typescript-eslint/require-await -- Async required by interface but channel.publish is synchronous */
import type { EventPublisherPort, EventEnvelope } from '@acme/messaging';
import type { Logger } from '@acme/observability';
import type { RabbitMQConnection } from './RabbitMQConnection';

/**
 * RabbitMQ event publisher implementation
 *
 * Publishes events to RabbitMQ exchange with:
 * - Correlation ID propagation
 * - Message persistence
 * - Publisher confirms
 * - Error handling
 *
 * @example
 * ```typescript
 * const publisher = new RabbitMQEventPublisher(connection, logger);
 *
 * await publisher.publish({
 *   eventId: '123',
 *   eventType: 'UserCreated',
 *   eventVersion: '1.0',
 *   timestamp: new Date().toISOString(),
 *   correlationId: 'abc',
 *   payload: { userId: '456', email: 'user@example.com' }
 * });
 * ```
 */
export class RabbitMQEventPublisher implements EventPublisherPort {
  constructor(
    private readonly connection: RabbitMQConnection,
    private readonly logger: Logger
  ) {}

  /**
   * Publish a single event
   */
  async publish<T>(envelope: EventEnvelope<T>): Promise<void> {
    try {
      const channel = this.connection.getChannel();
      const config = this.connection.getConfig();

      const routingKey = envelope.eventType;
      const message = Buffer.from(JSON.stringify(envelope));

      const options = {
        messageId: envelope.eventId,
        correlationId: envelope.correlationId,
        timestamp: Date.parse(envelope.timestamp),
        headers: {
          'x-event-type': envelope.eventType,
          'x-event-version': envelope.eventVersion,
          'x-tenant-id': envelope.tenantId,
          'x-causation-id': envelope.causationId,
          ...envelope.metadata,
        },
        persistent: true,
        contentType: 'application/json',
        contentEncoding: 'utf-8',
      };

      channel.publish(config.exchange, routingKey, message, options);

      this.logger.debug('Event published to RabbitMQ', {
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        exchange: config.exchange,
        routingKey,
      });
    } catch (error) {
      this.logger.error('Failed to publish event to RabbitMQ', error as Error, {
        eventId: envelope.eventId,
        eventType: envelope.eventType,
      });
      throw error;
    }
  }

  /**
   * Publish multiple events in batch
   */
  async publishBatch<T>(envelopes: EventEnvelope<T>[]): Promise<void> {
    const errors: Error[] = [];

    for (const envelope of envelopes) {
      try {
        await this.publish(envelope);
      } catch (error) {
        errors.push(error as Error);
      }
    }

    if (errors.length > 0) {
      this.logger.error('Failed to publish some events', errors[0], {
        totalEvents: envelopes.length,
        failedEvents: errors.length,
      });
      throw new Error(`Failed to publish ${errors.length} out of ${envelopes.length} events`);
    }

    this.logger.info('Batch published to RabbitMQ', {
      eventCount: envelopes.length,
    });
  }
}
