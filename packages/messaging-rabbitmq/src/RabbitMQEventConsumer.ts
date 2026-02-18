/* eslint-disable @typescript-eslint/no-unsafe-assignment -- amqplib returns any types */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- amqplib message properties */
/* eslint-disable @typescript-eslint/no-unsafe-call -- amqplib channel methods */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- envelope properties */
import type { EventConsumer, EventHandler, EventEnvelope } from '@acme/messaging';
import type { Logger } from '@acme/observability';
import type { Message, Channel } from 'amqplib';
import type { RabbitMQConnection } from './RabbitMQConnection';
import type { RabbitMQConsumerOptions } from './RabbitMQConfig';

/**
 * RabbitMQ event consumer with retry mechanism and DLQ support
 *
 * Features:
 * - Auto-retry with exponential backoff
 * - Dead Letter Queue for failed messages
 * - Message deduplication via messageId
 * - Graceful shutdown
 *
 * @example
 * ```typescript
 * const consumer = new RabbitMQEventConsumer(connection, logger);
 *
 * consumer.subscribe('UserCreated', {
 *   handle: async (envelope) => {
 *     console.log('User created:', envelope.payload);
 *   }
 * });
 *
 * await consumer.start();
 * ```
 */
export class RabbitMQEventConsumer implements EventConsumer {
  private readonly handlers = new Map<string, EventHandler<unknown>>();
  private readonly consumerTags: string[] = [];
  private isRunning = false;
  private readonly processedMessages = new Set<string>();

  constructor(
    private readonly connection: RabbitMQConnection,
    private readonly logger: Logger,
    private readonly options: RabbitMQConsumerOptions
  ) {}

  /**
   * Subscribe to an event type
   */
  subscribe<T>(eventType: string, handler: EventHandler<T>): void {
    if (this.isRunning === true) {
      throw new Error('Cannot subscribe after consumer is started');
    }

    this.handlers.set(eventType, handler as EventHandler<unknown>);
    this.logger.info('Subscribed to event type', { eventType });
  }

  /**
   * Start consuming messages
   */
  async start(): Promise<void> {
    if (this.isRunning === true) {
      throw new Error('Consumer is already running');
    }

    const channel = this.connection.getChannel();
    const config = this.connection.getConfig();

    // Assert queue
    const queueResult = await channel.assertQueue(this.options.queue, {
      durable: this.options.durable ?? true,
      exclusive: this.options.exclusive ?? false,
      arguments: this.buildQueueArguments(),
    });

    // Bind queue to exchange for each subscribed event type
    for (const eventType of this.handlers.keys()) {
      const routingKey = this.options.routingKey ?? eventType;
      await channel.bindQueue(queueResult.queue, config.exchange, routingKey);
      this.logger.info('Queue bound to exchange', {
        queue: queueResult.queue,
        exchange: config.exchange,
        routingKey,
      });
    }

    // Start consuming
    const consumeResult = await channel.consume(
      queueResult.queue,
      (msg) => {
        if (msg !== null) {
          this.handleMessage(msg).catch((err: Error) => {
            this.logger.error('Failed to handle message', err);
          });
        }
      },
      {
        noAck: this.options.autoAck ?? false,
      }
    );

    this.consumerTags.push(consumeResult.consumerTag);
    this.isRunning = true;

    this.logger.info('Consumer started', {
      queue: queueResult.queue,
      consumerTag: consumeResult.consumerTag,
      subscribedEvents: Array.from(this.handlers.keys()),
    });
  }

  /**
   * Stop consuming messages
   */
  async stop(): Promise<void> {
    if (this.isRunning === false) {
      return;
    }

    const channel = this.connection.getChannel();

    for (const consumerTag of this.consumerTags) {
      await channel.cancel(consumerTag);
    }

    this.consumerTags.length = 0;
    this.isRunning = false;
    this.processedMessages.clear();

    this.logger.info('Consumer stopped');
  }

  /**
   * Handle incoming message
   */
  /* eslint-disable max-lines-per-function -- Complex message handling with retry and DLQ logic */
  private async handleMessage(msg: Message): Promise<void> {
    const channel = this.connection.getChannel();

    try {
      const envelope = JSON.parse(msg.content.toString()) as EventEnvelope<unknown>;

      // Message deduplication
      if (this.processedMessages.has(envelope.eventId)) {
        this.logger.warn('Duplicate message detected, skipping', {
          eventId: envelope.eventId,
          eventType: envelope.eventType,
        });
        channel.ack(msg);
        return;
      }

      // Find handler
      const handler = this.handlers.get(envelope.eventType);
      if (handler === undefined) {
        this.logger.warn('No handler found for event type', {
          eventType: envelope.eventType,
        });
        channel.ack(msg);
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

      // Acknowledge message
      channel.ack(msg);

      this.logger.debug('Message processed successfully', {
        eventId: envelope.eventId,
        eventType: envelope.eventType,
      });
    } catch (error) {
      this.logger.error('Failed to process message', error as Error);

      // Handle retry logic
      if (this.shouldRetry(msg) === true) {
        this.retryMessage(msg, channel);
      } else {
        this.sendToDeadLetterQueue(msg, channel, error as Error);
      }
    }
  }

  /**
   * Check if message should be retried
   */
  private shouldRetry(msg: Message): boolean {
    const config = this.connection.getConfig();
    const retryCount = this.getRetryCount(msg);
    const maxRetries = this.options.maxRetries ?? config.maxRetries;

    return (this.options.enableRetry ?? true) === true && retryCount < maxRetries;
  }

  /**
   * Get retry count from message headers
   */
  private getRetryCount(msg: Message): number {
    const headers = msg.properties.headers;
    if (headers === undefined) {
      return 0;
    }
    const count = headers['x-retry-count'] as number | undefined;
    return count ?? 0;
  }

  /**
   * Retry message with exponential backoff
   */
  private retryMessage(msg: Message, channel: Channel): void {
    const config = this.connection.getConfig();
    const retryCount = this.getRetryCount(msg);
    const retryDelay = this.options.retryDelay ?? config.retryDelay;

    // Exponential backoff: delay * 2^retryCount
    const delay = retryDelay * Math.pow(2, retryCount);

    this.logger.warn('Retrying message', {
      messageId: msg.properties.messageId,
      retryCount: retryCount + 1,
      delay,
    });

    // Negative acknowledge with requeue
    channel.nack(msg, false, false);

    // Re-publish with updated retry count after delay
    setTimeout(() => {
      const newHeaders = {
        ...msg.properties.headers,
        'x-retry-count': retryCount + 1,
      };

      channel.publish(
        config.exchange,
        msg.fields.routingKey,
        msg.content,
        {
          ...msg.properties,
          headers: newHeaders,
        }
      );
    }, delay);
  }

  /**
   * Send message to Dead Letter Queue
   */
  private sendToDeadLetterQueue(
    msg: Message,
    channel: Channel,
    error: Error
  ): void {
    const config = this.connection.getConfig();

    if (config.enableDLQ === false) {
      // Just nack without requeue if DLQ is disabled
      channel.nack(msg, false, false);
      return;
    }

    const dlqExchange = config.exchange + config.dlqExchangeSuffix;

    this.logger.error('Sending message to DLQ', error, {
      messageId: msg.properties.messageId,
      dlqExchange,
    });

    const dlqHeaders = {
      ...msg.properties.headers,
      'x-death-reason': error.message,
      'x-death-timestamp': Date.now(),
      'x-original-exchange': msg.fields.exchange,
      'x-original-routing-key': msg.fields.routingKey,
    };

    // Publish to DLQ exchange
    channel.publish(dlqExchange, msg.fields.routingKey, msg.content, {
      ...msg.properties,
      headers: dlqHeaders,
    });

    // Acknowledge original message
    channel.ack(msg);
  }

  /**
   * Build queue arguments for DLQ support
   */
  private buildQueueArguments(): Record<string, unknown> {
    const config = this.connection.getConfig();

    if (config.enableDLQ === false) {
      return {};
    }

    const dlqExchange = config.exchange + config.dlqExchangeSuffix;

    return {
      'x-dead-letter-exchange': dlqExchange,
    };
  }
}
