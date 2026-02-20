/* eslint-disable @typescript-eslint/no-unsafe-assignment -- amqplib returns any types */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- amqplib channel properties */
/* eslint-disable @typescript-eslint/no-unsafe-call -- amqplib methods return any */
import type { ChannelModel, Channel, Options } from 'amqplib';
import { connect } from 'amqplib';
import type { Logger } from '@acme/observability';
import type { RabbitMQConfig, RabbitMQHealthCheck } from './RabbitMQConfig';
import { DEFAULT_RABBITMQ_CONFIG } from './RabbitMQConfig';

/**
 * RabbitMQ connection manager with pooling and health checks
 */
export class RabbitMQConnection {
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  private connection: ChannelModel | null = null;
  private channels: Channel[] = [];
  private readonly config: Required<RabbitMQConfig>;
  private isConnected = false;
  private lastError: string | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    config: RabbitMQConfig,
    private readonly logger: Logger,
  ) {
    this.config = { ...DEFAULT_RABBITMQ_CONFIG, ...config } as Required<RabbitMQConfig>;
  }

  /**
   * Establish connection to RabbitMQ and create channel pool
   */
  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to RabbitMQ...', { url: this.maskUrl(this.config.url) });

      const options: Options.Connect = {
        heartbeat: this.config.heartbeat,
      };

      this.connection = await connect(this.config.url, options);
      this.isConnected = true;
      this.lastError = undefined;

      // Setup connection error handlers
      this.connection.connection.on('error', (err: Error) => {
        this.logger.error('RabbitMQ connection error', err);
        this.lastError = err.message;
        this.handleDisconnect();
      });

      this.connection.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed');
        this.handleDisconnect();
      });

      // Create channel pool
      for (let i = 0; i < this.config.poolSize; i++) {
        const channel = await this.connection.createChannel();
        await channel.prefetch(this.config.prefetchCount);
        this.channels.push(channel);
      }

      // Assert exchange
      await this.assertExchange();

      this.logger.info('Connected to RabbitMQ successfully', {
        poolSize: this.channels.length,
        exchange: this.config.exchange,
      });
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to connect to RabbitMQ', error as Error);
      throw error;
    }
  }

  /**
   * Get a channel from the pool (round-robin)
   */
  getChannel(): Channel {
    if (this.channels.length === 0) {
      throw new Error('No channels available. Connection not established.');
    }

    // Simple round-robin
    const channel = this.channels.shift();
    if (channel === undefined) {
      throw new Error('Failed to get channel from pool');
    }
    this.channels.push(channel);
    return channel;
  }

  /**
   * Assert exchange exists
   */
  private async assertExchange(): Promise<void> {
    const channel = this.getChannel();
    await channel.assertExchange(this.config.exchange, this.config.exchangeType, { durable: true });

    // Assert DLQ exchange if enabled
    if (this.config.enableDLQ === true) {
      const dlqExchange = this.config.exchange + this.config.dlqExchangeSuffix;
      await channel.assertExchange(dlqExchange, this.config.exchangeType, {
        durable: true,
      });
    }
  }

  /**
   * Handle disconnection and attempt reconnect
   */
  private handleDisconnect(): void {
    this.isConnected = false;
    this.channels = [];

    // Attempt reconnect after delay
    this.reconnectTimer ??= setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((err: Error) => {
        this.logger.error('Reconnection failed', err);
      });
    }, this.config.retryDelay);
  }

  /**
   * Close connection and all channels
   */
  async close(): Promise<void> {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    for (const channel of this.channels) {
      await channel.close();
    }
    this.channels = [];

    if (this.connection !== null) {
      await this.connection.close();
      this.connection = null;
    }

    this.isConnected = false;
    this.logger.info('Disconnected from RabbitMQ');
  }

  /**
   * Health check
   */
  healthCheck(): RabbitMQHealthCheck {
    let status: 'connected' | 'disconnected' | 'reconnecting' = 'disconnected';

    if (this.isConnected === true && this.connection !== null) {
      status = 'connected';
    } else if (this.reconnectTimer !== null) {
      status = 'reconnecting';
    }

    const result: RabbitMQHealthCheck = {
      isHealthy: this.isConnected === true && this.channels.length > 0,
      connectionStatus: status,
      channelCount: this.channels.length,
    };

    if (this.lastError !== undefined) {
      result.lastError = this.lastError;
    }

    return result;
  }

  /**
   * Mask sensitive information in URL
   */
  private maskUrl(url: string): string {
    return url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  }

  /**
   * Get configuration
   */
  getConfig(): Required<RabbitMQConfig> {
    return this.config;
  }
}
