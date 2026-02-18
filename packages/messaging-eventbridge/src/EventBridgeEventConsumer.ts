/* eslint-disable @typescript-eslint/no-unsafe-assignment -- AWS SQS SDK returns any types in ESLint context */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- AWS SQS SDK properties */
/* eslint-disable @typescript-eslint/no-unsafe-call -- AWS SQS SDK methods and logger calls */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- AWS SQS SDK arguments */
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import type { EventConsumer, EventHandler, EventEnvelope } from '@acme/messaging';
import type { Logger } from '@acme/observability';
import type { EventBridgeSQSConsumerConfig } from './EventBridgeConfig';
import { DEFAULT_SQS_CONSUMER_CONFIG } from './EventBridgeConfig';

/**
 * Incoming EventBridge event structure as delivered by SQS target rule
 */
interface EventBridgeSQSMessage {
  readonly version: string;
  readonly id: string;
  readonly 'detail-type': string;
  readonly source: string;
  readonly account?: string;
  readonly time?: string;
  readonly region?: string;
  readonly detail: Record<string, unknown>;
}

/**
 * AWS EventBridge event consumer via SQS polling
 *
 * Implements EventConsumer that polls an SQS queue configured as an
 * EventBridge rule target. EventBridge routes matching events to SQS,
 * and this consumer polls the queue and dispatches to registered handlers.
 *
 * Flow:
 * ```
 * EventBridge Bus ──[Rule]──→ SQS Queue ──[Poll]──→ EventBridgeEventConsumer → Handlers
 * ```
 *
 * Features:
 * - Long-polling for efficient queue consumption
 * - Automatic message acknowledgement (delete) on success
 * - Manual retry on failure (message remains in queue / DLQ)
 * - Event type routing to registered handlers
 * - Deduplication via eventId tracking (10 000 entry LRU cap)
 * - Graceful shutdown via stop()
 *
 * @example
 * ```typescript
 * const consumer = new EventBridgeEventConsumer(sqsConfig, logger);
 * consumer.subscribe('OrderCreated', orderCreatedHandler);
 * await consumer.start();
 * // ... later
 * await consumer.stop();
 * ```
 */
export class EventBridgeEventConsumer implements EventConsumer {
  private readonly sqsClient: SQSClient;
  private readonly handlers = new Map<string, EventHandler<unknown>>();
  private readonly processedIds = new Set<string>();
  private readonly config: Required<Omit<EventBridgeSQSConsumerConfig, 'endpoint' | 'accessKeyId' | 'secretAccessKey' | 'sessionToken'>> & Pick<EventBridgeSQSConsumerConfig, 'endpoint' | 'accessKeyId' | 'secretAccessKey' | 'sessionToken'>;
  private running = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  private static readonly MAX_DEDUP_SIZE = 10_000;

  constructor(
    config: EventBridgeSQSConsumerConfig,
    private readonly logger: Logger,
  ) {
    this.config = { ...DEFAULT_SQS_CONSUMER_CONFIG, ...config };
    this.sqsClient = this.buildSQSClient();
  }

  /**
   * Register a handler for a specific event type (detail-type)
   */
  subscribe<T>(eventType: string, handler: EventHandler<T>): void {
    this.handlers.set(eventType, handler as EventHandler<unknown>);
    this.logger.debug('EventBridge handler registered', { eventType });
  }

  /**
   * Start polling the SQS queue
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.logger.info('EventBridge SQS consumer started', {
      queueUrl: this.config.queueUrl,
      handlers: Array.from(this.handlers.keys()),
    });
    await this.poll();
  }

  /**
   * Stop polling the SQS queue
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- EventConsumer interface requires Promise<void> but cleanup is synchronous
  async stop(): Promise<void> {
    this.running = false;
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.sqsClient.destroy();
    this.logger.info('EventBridge SQS consumer stopped');
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      const response = await this.sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: this.config.queueUrl,
          MaxNumberOfMessages: this.config.maxMessages,
          WaitTimeSeconds: this.config.waitTimeSeconds,
          VisibilityTimeout: this.config.visibilityTimeout,
          MessageAttributeNames: ['All'],
        }),
      );

      const messages = response.Messages ?? [];

      for (const message of messages) {
        await this.processMessage(message.Body, message.ReceiptHandle);
      }
    } catch (error) {
      this.logger.error('Error polling SQS queue', error as Error, {
        queueUrl: this.config.queueUrl,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- stop() may be called concurrently, re-check is intentional
    if (this.running) {
      this.pollTimer = setTimeout(() => {
        void this.poll();
      }, this.config.pollingIntervalMs);
    }
  }

  /* eslint-disable complexity -- EventBridge envelope parsing has multiple guard clauses */
  /* eslint-disable max-lines-per-function -- message processing logic requires full validation */
  private async processMessage(
    body: string | undefined,
    receiptHandle: string | undefined,
  ): Promise<void> {
    if (body === undefined || receiptHandle === undefined) return;

    let sqsMessage: EventBridgeSQSMessage;
    try {
      sqsMessage = JSON.parse(body) as EventBridgeSQSMessage;
    } catch {
      this.logger.warn('Failed to parse SQS message body', { body });
      return;
    }

    const eventType = sqsMessage['detail-type'];
    const detail = sqsMessage.detail;
    const eventId = typeof detail['eventId'] === 'string' ? detail['eventId'] : sqsMessage.id;

    // Deduplication
    if (this.processedIds.has(eventId)) {
      this.logger.debug('Duplicate event skipped', { eventId });
      await this.deleteMessage(receiptHandle);
      return;
    }

    const handler = this.handlers.get(eventType);
    if (handler === undefined) {
      this.logger.debug('No handler for event type, skipping', { eventType });
      await this.deleteMessage(receiptHandle);
      return;
    }

    const correlationId = typeof detail['correlationId'] === 'string' ? detail['correlationId'] : undefined;
    const causationId = typeof detail['causationId'] === 'string' ? detail['causationId'] : undefined;
    const tenantId = typeof detail['tenantId'] === 'string' ? detail['tenantId'] : undefined;
    const metadata = typeof detail['metadata'] === 'object' && detail['metadata'] !== null
      ? (detail['metadata'] as Record<string, unknown>)
      : undefined;

    const envelope: EventEnvelope<unknown> = {
      eventId,
      eventType,
      eventVersion: typeof detail['eventVersion'] === 'string' ? detail['eventVersion'] : '1.0',
      timestamp: typeof detail['timestamp'] === 'string' ? detail['timestamp'] : (sqsMessage.time ?? new Date().toISOString()),
      payload: detail['payload'] ?? detail,
      ...(correlationId === undefined ? {} : { correlationId }),
      ...(causationId === undefined ? {} : { causationId }),
      ...(tenantId === undefined ? {} : { tenantId }),
      ...(metadata === undefined ? {} : { metadata }),
    };

    try {
      await handler.handle(envelope);

      // Acknowledge only on success
      await this.deleteMessage(receiptHandle);

      // Track deduplicated ID
      this.trackProcessedId(eventId);

      this.logger.debug('Event processed successfully', { eventId, eventType });
    } catch (error) {
      this.logger.error('Error processing EventBridge event', error as Error, {
        eventId,
        eventType,
      });
      // Do NOT delete – message will be redelivered or sent to DLQ
    }
  }
  /* eslint-enable complexity */
  /* eslint-enable max-lines-per-function */

  private async deleteMessage(receiptHandle: string): Promise<void> {
    try {
      await this.sqsClient.send(
        new DeleteMessageCommand({
          QueueUrl: this.config.queueUrl,
          ReceiptHandle: receiptHandle,
        }),
      );
    } catch (error) {
      this.logger.warn('Failed to delete SQS message', {
        receiptHandle,
        error: (error as Error).message,
      });
    }
  }

  private trackProcessedId(eventId: string): void {
    if (this.processedIds.size >= EventBridgeEventConsumer.MAX_DEDUP_SIZE) {
      // Evict the oldest entry (first inserted)
      const first = this.processedIds.values().next().value;
      if (first !== undefined) {
        this.processedIds.delete(first);
      }
    }
    this.processedIds.add(eventId);
  }

  private buildSQSClient(): SQSClient {
    const clientConfig: ConstructorParameters<typeof SQSClient>[0] = {
      region: this.config.region,
    };

    if (this.config.endpoint !== undefined) {
      (clientConfig as Record<string, unknown>)['endpoint'] = this.config.endpoint;
    }

    if (
      this.config.accessKeyId !== undefined &&
      this.config.secretAccessKey !== undefined
    ) {
      clientConfig.credentials = {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
        ...(this.config.sessionToken === undefined
          ? {}
          : { sessionToken: this.config.sessionToken }),
      };
    }

    return new SQSClient(clientConfig);
  }
}
