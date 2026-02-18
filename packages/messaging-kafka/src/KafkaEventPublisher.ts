/* eslint-disable @typescript-eslint/no-unsafe-member-access -- kafkajs properties */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- envelope metadata spread */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- envelope properties */
/* eslint-disable @typescript-eslint/no-unsafe-call -- logger methods */
import type { EventPublisherPort, EventEnvelope } from '@acme/messaging';
import type { Logger } from '@acme/observability';
import type { KafkaConnection } from './KafkaConnection';

/**
 * Kafka event publisher with transactional support
 *
 * Features:
 * - Idempotent producer for at-least-once delivery
 * - Optional transactions for exactly-once semantics
 * - Automatic topic creation
 * - Partition key support (uses eventId by default)
 * - Compression (gzip by default)
 *
 * @example
 * ```typescript
 * const publisher = new KafkaEventPublisher(connection, logger);
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
export class KafkaEventPublisher implements EventPublisherPort {
  constructor(
    private readonly connection: KafkaConnection,
    private readonly logger: Logger
  ) {}

  /**
   * Publish a single event
   *
   * Uses transactions if configured, otherwise uses idempotent producer
   */
  /* eslint-disable max-lines-per-function -- Transaction handling requires multiple steps */
  async publish<T>(envelope: EventEnvelope<T>): Promise<void> {
    const config = this.connection.getConfig();
    const producer = this.connection.getProducer();
    const topic = envelope.eventType;

    try {
      const message = {
        key: envelope.eventId, // Partition key for ordering
        value: JSON.stringify(envelope),
        headers: {
          'event-id': envelope.eventId,
          'event-type': envelope.eventType,
          'event-version': envelope.eventVersion,
          'correlation-id': envelope.correlationId ?? '',
          'causation-id': envelope.causationId ?? '',
          'tenant-id': envelope.tenantId ?? '',
          'timestamp': envelope.timestamp,
        },
      };

      // Use transactions for exactly-once semantics
      if (config.transactional === true) {
        const transaction = await producer.transaction();
        try {
          await transaction.send({
            topic,
            messages: [message],
          });
          await transaction.commit();
        } catch (error) {
          await transaction.abort();
          throw error;
        }
      } else {
        // Use idempotent producer for at-least-once
        await producer.send({
          topic,
          messages: [message],
        });
      }

      this.logger.debug('Event published to Kafka', {
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        topic,
        transactional: config.transactional,
      });
    } catch (error) {
      this.logger.error('Failed to publish event to Kafka', error as Error, {
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        topic,
      });
      throw error;
    }
  }
  /* eslint-enable max-lines-per-function */

  /**
   * Publish multiple events in batch
   *
   * All events go to their respective topics
   * Uses single transaction if transactional mode is enabled
   */
  /* eslint-disable max-lines-per-function -- Batch processing requires grouping and transactions */
  /* eslint-disable complexity -- Transaction branching and topic grouping */
  async publishBatch<T>(envelopes: EventEnvelope<T>[]): Promise<void> {
    if (envelopes.length === 0) {
      return;
    }

    const config = this.connection.getConfig();
    const producer = this.connection.getProducer();

    try {
      // Group messages by topic
      const messagesByTopic = new Map<string, Array<{ key: string; value: string; headers: Record<string, string> }>>();

      for (const envelope of envelopes) {
        const topic = envelope.eventType;
        if (!messagesByTopic.has(topic)) {
          messagesByTopic.set(topic, []);
        }

        messagesByTopic.get(topic)!.push({
          key: envelope.eventId,
          value: JSON.stringify(envelope),
          headers: {
            'event-id': envelope.eventId,
            'event-type': envelope.eventType,
            'event-version': envelope.eventVersion,
            'correlation-id': envelope.correlationId ?? '',
            'causation-id': envelope.causationId ?? '',
            'tenant-id': envelope.tenantId ?? '',
            'timestamp': envelope.timestamp,
          },
        });
      }

      // Use transactions for exactly-once semantics
      if (config.transactional === true) {
        const transaction = await producer.transaction();
        try {
          for (const [topic, messages] of messagesByTopic.entries()) {
            await transaction.send({ topic, messages });
          }
          await transaction.commit();
        } catch (error) {
          await transaction.abort();
          throw error;
        }
      } else {
        // Send to all topics in parallel
        await Promise.all(
          Array.from(messagesByTopic.entries()).map(([topic, messages]) =>
            producer.send({ topic, messages })
          )
        );
      }

      this.logger.info('Batch published to Kafka', {
        eventCount: envelopes.length,
        topics: Array.from(messagesByTopic.keys()),
        transactional: config.transactional,
      });
    } catch (error) {
      this.logger.error('Failed to publish batch to Kafka', error as Error, {
        eventCount: envelopes.length,
      });
      throw error;
    }
  }
  /* eslint-enable max-lines-per-function */
  /* eslint-enable complexity */
}
