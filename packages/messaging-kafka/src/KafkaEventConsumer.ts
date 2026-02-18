/* eslint-disable @typescript-eslint/no-unsafe-assignment -- kafkajs returns any types */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- kafkajs message properties */
/* eslint-disable @typescript-eslint/no-unsafe-call -- kafkajs methods */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- envelope properties */
import type { EventConsumer, EventHandler, EventEnvelope } from '@acme/messaging';
import type { Logger } from '@acme/observability';
import type { Consumer, EachMessagePayload } from 'kafkajs';
import type { KafkaConnection } from './KafkaConnection';
import type { KafkaConsumerOptions } from './KafkaConfig';
import { DEFAULT_CONSUMER_OPTIONS } from './KafkaConfig';

/**
 * Kafka event consumer with consumer groups and manual offset management
 *
 * Features:
 * - Consumer groups for horizontal scaling
 * - Manual offset commit for at-least-once delivery
 * - Automatic partition rebalancing
 * - Message deduplication via eventId
 * - Graceful shutdown
 *
 * @example
 * ```typescript
 * const consumer = new KafkaEventConsumer(connection, logger, {
 *   groupId: 'order-service-group',
 *   topics: ['OrderCreated', 'OrderUpdated'],
 * });
 *
 * consumer.subscribe('OrderCreated', {
 *   handle: async (envelope) => {
 *     console.log('Order created:', envelope.payload);
 *   }
 * });
 *
 * await consumer.start();
 * ```
 */
export class KafkaEventConsumer implements EventConsumer {
  private readonly handlers = new Map<string, EventHandler<unknown>>();
  private consumer: Consumer | null = null;
  private isRunning = false;
  private readonly processedMessages = new Set<string>();
  private readonly options: Required<KafkaConsumerOptions>;

  constructor(
    private readonly connection: KafkaConnection,
    private readonly logger: Logger,
    options: KafkaConsumerOptions
  ) {
    this.options = { ...DEFAULT_CONSUMER_OPTIONS, ...options } as Required<KafkaConsumerOptions>;
  }

  /**
   * Subscribe to an event type
   */
  subscribe<T>(eventType: string, handler: EventHandler<T>): void {
    if (this.isRunning === true) {
      throw new Error('Cannot subscribe after consumer is started');
    }

    this.handlers.set(eventType, handler as EventHandler<unknown>);
    this.logger.info('Subscribed to event type', { eventType, groupId: this.options.groupId });
  }

  /**
   * Start consuming messages
   */
  async start(): Promise<void> {
    if (this.isRunning === true) {
      throw new Error('Consumer is already running');
    }

    try {
      const kafka = this.connection.getKafka();

      // Create consumer with group
      this.consumer = kafka.consumer({
        groupId: this.options.groupId,
        sessionTimeout: this.options.sessionTimeout,
        rebalanceTimeout: this.options.rebalanceTimeout,
        heartbeatInterval: this.options.heartbeatInterval,
        maxBytesPerPartition: this.options.maxBytesPerPartition,
        retry: this.options.retry,
      });

      await this.consumer.connect();

      // Subscribe to topics
      await this.consumer.subscribe({
        topics: this.options.topics,
        fromBeginning: this.options.fromBeginning,
      });

      // Start consuming
      await this.consumer.run({
        autoCommit: this.options.autoCommit,
        autoCommitInterval: this.options.autoCommitInterval,
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(payload);
        },
      });

      this.isRunning = true;

      this.logger.info('Kafka consumer started', {
        groupId: this.options.groupId,
        topics: this.options.topics,
        subscribedEvents: Array.from(this.handlers.keys()),
      });
    } catch (error) {
      this.logger.error('Failed to start Kafka consumer', error as Error, {
        groupId: this.options.groupId,
      });
      throw error;
    }
  }

  /**
   * Stop consuming messages
   */
  async stop(): Promise<void> {
    if (this.isRunning === false || this.consumer === null) {
      return;
    }

    try {
      await this.consumer.stop();
      await this.consumer.disconnect();
      this.consumer = null;
      this.isRunning = false;
      this.processedMessages.clear();

      this.logger.info('Kafka consumer stopped', {
        groupId: this.options.groupId,
      });
    } catch (error) {
      this.logger.error('Error stopping Kafka consumer', error as Error);
      throw error;
    }
  }

  /**
   * Handle incoming message
   */
  /* eslint-disable max-lines-per-function -- Message handling with offset management and deduplication */
  /* eslint-disable complexity -- Multiple validation and error handling paths */
  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    try {
      const envelope = JSON.parse(message.value?.toString() ?? '{}') as EventEnvelope<unknown>;

      // Message deduplication
      if (this.processedMessages.has(envelope.eventId)) {
        this.logger.warn('Duplicate message detected, skipping', {
          eventId: envelope.eventId,
          eventType: envelope.eventType,
          topic,
          partition,
          offset: message.offset,
        });

        // Still commit offset to avoid reprocessing
        if (this.options.autoCommit === false && this.consumer !== null) {
          await this.consumer.commitOffsets([{
            topic,
            partition,
            offset: (Number(message.offset) + 1).toString(),
          }]);
        }
        return;
      }

      // Find handler for event type
      const handler = this.handlers.get(envelope.eventType);
      if (handler === undefined) {
        this.logger.warn('No handler found for event type', {
          eventType: envelope.eventType,
          topic,
        });

        // Commit offset for unhandled messages to avoid blocking
        if (this.options.autoCommit === false && this.consumer !== null) {
          await this.consumer.commitOffsets([{
            topic,
            partition,
            offset: (Number(message.offset) + 1).toString(),
          }]);
        }
        return;
      }

      // Process message
      await handler.handle(envelope);

      // Mark as processed
      this.processedMessages.add(envelope.eventId);

      // Limit set size to prevent memory leaks
      if (this.processedMessages.size > 10000) {
        const firstItem = this.processedMessages.values().next().value as string;
        this.processedMessages.delete(firstItem);
      }

      // Manual offset commit for at-least-once delivery
      if (this.options.autoCommit === false && this.consumer !== null) {
        await this.consumer.commitOffsets([{
          topic,
          partition,
          offset: (Number(message.offset) + 1).toString(),
        }]);
      }

      this.logger.debug('Message processed successfully', {
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        topic,
        partition,
        offset: message.offset,
      });
    } catch (error) {
      this.logger.error('Failed to handle message', error as Error, {
        topic,
        partition,
        offset: message.offset,
      });

      // Don't commit offset on error - message will be redelivered
      throw error;
    }
  }
  /* eslint-enable max-lines-per-function */
  /* eslint-enable complexity */
}
