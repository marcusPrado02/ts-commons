/* eslint-disable @typescript-eslint/no-unsafe-assignment -- AWS SDK returns any types in ESLint context */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- AWS SDK properties and logger methods */
/* eslint-disable @typescript-eslint/no-unsafe-call -- AWS SDK methods and logger calls */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents -- EventBridgeClient typed as any in ESLint context */
import { EventBridgeClient, DescribeEventBusCommand } from '@aws-sdk/client-eventbridge';
import type { Logger } from '@acme/observability';
import type { EventBridgeConfig, EventBridgeHealthCheck } from './EventBridgeConfig';
import { DEFAULT_EVENTBRIDGE_CONFIG } from './EventBridgeConfig';

/**
 * AWS EventBridge connection manager
 *
 * Manages the AWS SDK EventBridgeClient lifecycle with:
 * - Credential configuration (explicit or default chain)
 * - Custom endpoint support (LocalStack compatibility)
 * - Health monitoring via DescribeEventBus
 * - Graceful shutdown
 *
 * @example
 * ```typescript
 * const connection = new EventBridgeConnection(config, logger);
 * await connection.connect();
 *
 * const client = connection.getClient();
 * await client.send(new PutEventsCommand({ Entries: [...] }));
 *
 * await connection.close();
 * ```
 */
export class EventBridgeConnection {
  private client: EventBridgeClient | null = null;
  private isConnected = false;
  private lastErrorMessage: string | undefined;
  private publishedCount = 0;
  private errorCount = 0;
  private readonly config: Required<Omit<EventBridgeConfig, 'endpoint' | 'accessKeyId' | 'secretAccessKey' | 'sessionToken'>> & Pick<EventBridgeConfig, 'endpoint' | 'accessKeyId' | 'secretAccessKey' | 'sessionToken'>;

  constructor(
    config: EventBridgeConfig,
    private readonly logger: Logger,
  ) {
    this.config = { ...DEFAULT_EVENTBRIDGE_CONFIG, ...config };
  }

  /**
   * Connect to EventBridge and verify access to the event bus
   */
  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to AWS EventBridge', {
        region: this.config.region,
        eventBusName: this.config.eventBusName,
      });

      this.client = this.buildClient();

      // Verify connectivity by describing the event bus
      await this.client.send(
        new DescribeEventBusCommand({ Name: this.config.eventBusName }),
      );

      this.isConnected = true;
      this.logger.info('Connected to AWS EventBridge successfully', {
        region: this.config.region,
        eventBusName: this.config.eventBusName,
      });
    } catch (error) {
      this.lastErrorMessage = (error as Error).message;
      this.logger.error('Failed to connect to AWS EventBridge', error as Error, {
        region: this.config.region,
        eventBusName: this.config.eventBusName,
      });
      throw error;
    }
  }

  /**
   * Get the EventBridgeClient instance
   */
  getClient(): EventBridgeClient {
    if (this.client === null) {
      throw new Error('EventBridgeClient not initialized. Call connect() first');
    }
    return this.client;
  }

  /**
   * Get the resolved configuration
   */
  getConfig(): typeof this.config {
    return this.config;
  }

  /**
   * Increment published event counter (called by publisher)
   */
  incrementPublished(): void {
    this.publishedCount++;
  }

  /**
   * Increment error counter (called by publisher on failure)
   */
  incrementErrors(): void {
    this.errorCount++;
  }

  /**
   * Record last error message
   */
  setLastError(message: string): void {
    this.lastErrorMessage = message;
  }

  /**
   * Perform a health check by describing the event bus
   */
  async healthCheck(): Promise<EventBridgeHealthCheck> {
    if (this.client === null) {
      return {
        connected: false,
        region: this.config.region,
        eventBusName: this.config.eventBusName,
        lastError: 'Client not initialized',
        publishedCount: this.publishedCount,
        errorCount: this.errorCount,
      };
    }

    try {
      await this.client.send(
        new DescribeEventBusCommand({ Name: this.config.eventBusName }),
      );
      return {
        connected: true,
        region: this.config.region,
        eventBusName: this.config.eventBusName,
        lastError: this.lastErrorMessage,
        publishedCount: this.publishedCount,
        errorCount: this.errorCount,
      };
    } catch (error) {
      const message = (error as Error).message;
      this.lastErrorMessage = message;
      return {
        connected: false,
        region: this.config.region,
        eventBusName: this.config.eventBusName,
        lastError: message,
        publishedCount: this.publishedCount,
        errorCount: this.errorCount,
      };
    }
  }

  /**
   * Close the client connection
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- SDK client.destroy() is sync but interface requires Promise<void>
  async close(): Promise<void> {
    if (this.client !== null) {
      this.client.destroy();
      this.client = null;
    }
    this.isConnected = false;
    this.logger.info('EventBridge connection closed');
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }

  private buildClient(): EventBridgeClient {
    const clientConfig: ConstructorParameters<typeof EventBridgeClient>[0] = {
      region: this.config.region,
      maxAttempts: this.config.maxRetries,
    };

    if (this.config.endpoint !== undefined) {
      clientConfig.endpoint = this.config.endpoint;
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

    return new EventBridgeClient(clientConfig);
  }
}
