/* eslint-disable @typescript-eslint/no-unsafe-assignment -- kafkajs returns any types */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- kafkajs properties */
/* eslint-disable @typescript-eslint/no-unsafe-call -- kafkajs methods */
import { Kafka, logLevel } from 'kafkajs';
import type { Producer, Admin } from 'kafkajs';
import type { Logger } from '@acme/observability';
import type { KafkaConfig, KafkaHealthCheck, KafkaProducerOptions } from './KafkaConfig';
import { DEFAULT_KAFKA_CONFIG, DEFAULT_PRODUCER_OPTIONS } from './KafkaConfig';

/**
 * Kafka connection manager
 *
 * Manages Kafka client, producer, and admin connections with:
 * - Idempotent producer for at-least-once delivery
 * - Optional transactional producer for exactly-once semantics
 * - Health monitoring
 * - Automatic reconnection
 *
 * @example
 * ```typescript
 * const connection = new KafkaConnection(config, logger);
 * await connection.connect();
 *
 * const producer = connection.getProducer();
 * await producer.send({ topic: 'orders', messages: [...] });
 *
 * await connection.close();
 * ```
 */
export class KafkaConnection {
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private admin: Admin | null = null;
  private readonly config: Required<Omit<KafkaConfig, 'transactionalId' | 'kafkaJSConfig'>> & Pick<KafkaConfig, 'transactionalId' | 'kafkaJSConfig'>;
  private readonly producerOptions: Required<Omit<KafkaProducerOptions, 'batch'>> & Pick<KafkaProducerOptions, 'batch'>;
  private isConnected = false;
  private lastError: string | undefined;

  constructor(
    config: KafkaConfig,
    private readonly logger: Logger,
    producerOptions: KafkaProducerOptions = {}
  ) {
    this.config = { ...DEFAULT_KAFKA_CONFIG, ...config };
    this.producerOptions = { ...DEFAULT_PRODUCER_OPTIONS, ...producerOptions };

    // Validate transactional configuration
    if (this.config.transactional === true && (this.config.transactionalId === undefined || this.config.transactionalId === '')) {
      throw new Error('transactionalId is required when transactional is true');
    }
  }

  /**
   * Connect to Kafka and initialize producer
   */
  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to Kafka', {
        brokers: this.config.brokers,
        clientId: this.config.clientId,
      });

      // Create Kafka client
      this.kafka = new Kafka({
        clientId: this.config.clientId,
        brokers: this.config.brokers,
        connectionTimeout: this.config.connectionTimeout,
        requestTimeout: this.config.requestTimeout,
        logLevel: logLevel.ERROR,
        ...this.config.kafkaJSConfig,
      });

      // Create admin client
      this.admin = this.kafka.admin();
      await this.admin.connect();

      // Create producer
      const producerConfig: Parameters<Kafka['producer']>[0] = {
        idempotent: this.config.idempotent,
        maxInFlightRequests: this.config.maxInFlightRequests,
      };

      // Add transactionalId only if defined
      if (this.config.transactionalId !== undefined) {
        producerConfig.transactionalId = this.config.transactionalId;
      }

      this.producer = this.kafka.producer(producerConfig);

      await this.producer.connect();

      this.isConnected = true;
      this.logger.info('Connected to Kafka successfully', {
        brokers: this.config.brokers,
        idempotent: this.config.idempotent,
        transactional: this.config.transactional,
      });
    } catch (error) {
      this.lastError = (error as Error).message;
      this.logger.error('Failed to connect to Kafka', error as Error, {
        brokers: this.config.brokers,
      });
      throw error;
    }
  }

  /**
   * Get Kafka producer instance
   */
  getProducer(): Producer {
    if (this.producer === null) {
      throw new Error('Producer not initialized. Call connect() first');
    }
    return this.producer;
  }

  /**
   * Get Kafka admin client
   */
  getAdmin(): Admin {
    if (this.admin === null) {
      throw new Error('Admin not initialized. Call connect() first');
    }
    return this.admin;
  }

  /**
   * Get Kafka client instance
   */
  getKafka(): Kafka {
    if (this.kafka === null) {
      throw new Error('Kafka not initialized. Call connect() first');
    }
    return this.kafka;
  }

  /**
   * Get connection configuration
   */
  getConfig(): KafkaConfig {
    return this.config;
  }

  /**
   * Get producer options
   */
  getProducerOptions(): KafkaProducerOptions {
    return this.producerOptions;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<KafkaHealthCheck> {
    if (this.lastError !== undefined) {
      return {
        isHealthy: false,
        connectionStatus: 'disconnected',
        connectedBrokers: 0,
        producerReady: false,
        consumerReady: false,
        lastError: this.lastError,
      };
    }

    if (!this.isConnected || this.admin === null) {
      return {
        isHealthy: false,
        connectionStatus: 'disconnected',
        connectedBrokers: 0,
        producerReady: false,
        consumerReady: false,
      };
    }

    try {
      // Check broker connectivity
      const cluster = await this.admin.describeCluster();
      const connectedBrokers = cluster.brokers.length;
      const producerReady = this.producer !== null;

      return {
        isHealthy: connectedBrokers > 0 && producerReady,
        connectionStatus: 'connected',
        connectedBrokers,
        producerReady,
        consumerReady: false,
      };
    } catch (error) {
      this.logger.warn('Kafka health check failed', { error: (error as Error).message });
      return {
        isHealthy: false,
        connectionStatus: 'error',
        connectedBrokers: 0,
        producerReady: false,
        consumerReady: false,
        lastError: (error as Error).message,
      };
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    this.logger.info('Closing Kafka connections');

    try {
      if (this.producer !== null) {
        await this.producer.disconnect();
        this.producer = null;
      }

      if (this.admin !== null) {
        await this.admin.disconnect();
        this.admin = null;
      }

      this.kafka = null;
      this.isConnected = false;

      this.logger.info('Kafka connections closed');
    } catch (error) {
      this.logger.error('Error closing Kafka connections', error as Error);
      throw error;
    }
  }
}
