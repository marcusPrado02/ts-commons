/* eslint-disable @typescript-eslint/no-unsafe-assignment -- AWS SDK returns any types in ESLint context */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- AWS SDK and envelope properties */
/* eslint-disable @typescript-eslint/no-unsafe-call -- AWS SDK methods and logger calls */
/* eslint-disable @typescript-eslint/no-unsafe-return -- AWS SDK typed as any in ESLint context */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- envelope and AWS SDK arguments */
import { PutEventsCommand } from '@aws-sdk/client-eventbridge';
import type { PutEventsRequestEntry } from '@aws-sdk/client-eventbridge';
import type { EventPublisherPort, EventEnvelope } from '@acme/messaging';
import type { Logger } from '@acme/observability';
import type { EventBridgeConnection } from './EventBridgeConnection';

/**
 * AWS EventBridge event publisher
 *
 * Implements EventPublisherPort to publish domain events to an EventBridge
 * event bus with:
 * - Automatic envelope serialization to EventBridge detail format
 * - Batch publishing (AWS PutEvents supports up to 10 entries per call)
 * - Correlation ID and metadata propagation via custom headers
 * - Retry via AWS SDK built-in retry mechanism
 * - Failed entry detection (AWS returns partial failures)
 *
 * Architecture:
 * ```
 * Domain Event → EventEnvelope → PutEventsEntry → EventBridge Bus → Target Rules
 * ```
 *
 * @example
 * ```typescript
 * const publisher = new EventBridgeEventPublisher(connection, logger);
 *
 * await publisher.publish({
 *   eventId: uuid(),
 *   eventType: 'OrderCreated',
 *   eventVersion: '1.0',
 *   timestamp: new Date().toISOString(),
 *   payload: { orderId: '123', amount: 99.99 },
 * });
 * ```
 */
export class EventBridgeEventPublisher implements EventPublisherPort {
  constructor(
    private readonly connection: EventBridgeConnection,
    private readonly logger: Logger,
  ) {}

  /**
   * Publish a single event to EventBridge
   */
  async publish<T>(envelope: EventEnvelope<T>): Promise<void> {
    const entry = this.buildEntry(envelope);
    const config = this.connection.getConfig();

    try {
      this.logger.debug('Publishing event to EventBridge', {
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        eventBusName: config.eventBusName,
      });

      const command = new PutEventsCommand({
        Entries: [entry],
      });

      const result = await this.connection.getClient().send(command);

      if ((result.FailedEntryCount ?? 0) > 0) {
        const failedEntry = result.Entries?.[0];
        const errorMsg = `EventBridge rejected event: ${failedEntry?.ErrorCode ?? 'Unknown'} - ${failedEntry?.ErrorMessage ?? 'No message'}`;
        this.connection.incrementErrors();
        this.connection.setLastError(errorMsg);
        throw new Error(errorMsg);
      }

      this.connection.incrementPublished();
      this.logger.debug('Event published successfully', {
        eventId: envelope.eventId,
        eventType: envelope.eventType,
      });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith('EventBridge rejected')) {
        this.connection.incrementErrors();
        this.connection.setLastError((error as Error).message);
      }
      this.logger.error('Failed to publish event to EventBridge', error as Error, {
        eventId: envelope.eventId,
        eventType: envelope.eventType,
      });
      throw error;
    }
  }

  /**
   * Publish multiple events to EventBridge
   *
   * AWS PutEvents supports up to 10 entries per call. This method
   * automatically splits batches that exceed the limit.
   */
  /* eslint-disable max-lines-per-function -- batch logic requires more than one chunk of code */
  async publishBatch<T>(envelopes: EventEnvelope<T>[]): Promise<void> {
    if (envelopes.length === 0) return;

    const config = this.connection.getConfig();
    const chunkSize = config.maxBatchSize;
    const errors: string[] = [];

    for (let i = 0; i < envelopes.length; i += chunkSize) {
      const chunk = envelopes.slice(i, i + chunkSize);
      const entries = chunk.map((e) => this.buildEntry(e));

      try {
        this.logger.debug('Publishing event batch to EventBridge', {
          count: chunk.length,
          eventBusName: config.eventBusName,
        });

        const command = new PutEventsCommand({ Entries: entries });
        const result = await this.connection.getClient().send(command);

        const failedCount = result.FailedEntryCount ?? 0;
        if (failedCount > 0) {
          result.Entries?.forEach((entry, idx) => {
            if (entry.ErrorCode === undefined) {
              this.connection.incrementPublished();
            } else {
              const envelope = chunk[idx];
              const msg = `Failed to publish event ${envelope?.eventId ?? idx}: ${entry.ErrorCode} - ${entry.ErrorMessage ?? ''}`;
              errors.push(msg);
              this.connection.incrementErrors();
            }
          });
        } else {
          chunk.forEach(() => { this.connection.incrementPublished(); });
        }
      } catch (error) {
        const msg = (error as Error).message;
        errors.push(`Batch chunk failed: ${msg}`);
        this.connection.incrementErrors();
        this.connection.setLastError(msg);
        this.logger.error('Failed to publish event batch to EventBridge', error as Error, {
          chunkStart: i,
          chunkSize: chunk.length,
        });
      }
    }

    if (errors.length > 0) {
      throw new Error(`EventBridge batch publish failed:\n${errors.join('\n')}`);
    }

    this.logger.debug('Batch published successfully', {
      count: envelopes.length,
      eventBusName: config.eventBusName,
    });
  }
  /* eslint-enable max-lines-per-function */

  /**
   * Build an EventBridge PutEventsRequestEntry from an EventEnvelope
   */
  private buildEntry<T>(envelope: EventEnvelope<T>): PutEventsRequestEntry {
    const config = this.connection.getConfig();

    const detail: Record<string, unknown> = {
      eventId: envelope.eventId,
      eventVersion: envelope.eventVersion,
      timestamp: envelope.timestamp,
      payload: envelope.payload,
      ...(envelope.correlationId === undefined ? {} : { correlationId: envelope.correlationId }),
      ...(envelope.causationId === undefined ? {} : { causationId: envelope.causationId }),
      ...(envelope.tenantId === undefined ? {} : { tenantId: envelope.tenantId }),
      ...(envelope.metadata === undefined ? {} : { metadata: envelope.metadata }),
    };

    return {
      EventBusName: config.eventBusName,
      Source: config.source,
      DetailType: envelope.eventType,
      Detail: JSON.stringify(detail),
      Time: new Date(envelope.timestamp),
    };
  }
}
