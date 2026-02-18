import type { KafkaConfig as KafkaJSConfig } from 'kafkajs';

/**
 * Kafka connection configuration
 */
export interface KafkaConfig {
  /**
   * Kafka brokers URLs
   * @example ['localhost:9092', 'localhost:9093']
   */
  readonly brokers: string[];

  /**
   * Client ID for the connection
   * @default 'acme-kafka-client'
   */
  readonly clientId?: string;

  /**
   * Connection timeout in milliseconds
   * @default 30000
   */
  readonly connectionTimeout?: number;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  readonly requestTimeout?: number;

  /**
   * Enable idempotent producer
   * @default true
   */
  readonly idempotent?: boolean;

  /**
   * Max in-flight requests
   * @default 5
   */
  readonly maxInFlightRequests?: number;

  /**
   * Enable transactional producer
   * @default false
   */
  readonly transactional?: boolean;

  /**
   * Transaction ID for exactly-once semantics
   * Required when transactional is true
   */
  readonly transactionalId?: string;

  /**
   * Additional KafkaJS configuration
   */
  readonly kafkaJSConfig?: Partial<KafkaJSConfig>;
}

/**
 * Kafka consumer configuration
 */
export interface KafkaConsumerOptions {
  /**
   * Consumer group ID
   * @example 'order-service-group'
   */
  readonly groupId: string;

  /**
   * Topics to subscribe to
   * @example ['order.created', 'order.updated']
   */
  readonly topics: string[];

  /**
   * Start consuming from beginning
   * @default false
   */
  readonly fromBeginning?: boolean;

  /**
   * Auto-commit offsets
   * @default false (manual commit for better control)
   */
  readonly autoCommit?: boolean;

  /**
   * Auto-commit interval in milliseconds
   * @default 5000
   */
  readonly autoCommitInterval?: number;

  /**
   * Session timeout in milliseconds
   * @default 30000
   */
  readonly sessionTimeout?: number;

  /**
   * Rebalance timeout in milliseconds
   * @default 60000
   */
  readonly rebalanceTimeout?: number;

  /**
   * Heartbeat interval in milliseconds
   * @default 3000
   */
  readonly heartbeatInterval?: number;

  /**
   * Max bytes per partition
   * @default 1048576 (1MB)
   */
  readonly maxBytesPerPartition?: number;

  /**
   * Retry configuration
   */
  readonly retry?: {
    /**
     * Maximum retry attempts
     * @default 3
     */
    readonly maxRetries: number;

    /**
     * Initial retry delay in milliseconds
     * @default 1000
     */
    readonly initialRetryTime: number;

    /**
     * Retry backoff multiplier
     * @default 2
     */
    readonly multiplier: number;
  };
}

/**
 * Kafka producer configuration
 */
export interface KafkaProducerOptions {
  /**
   * Compression type
   * @default 'gzip'
   */
  readonly compression?: 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd';

  /**
   * Required acknowledgements
   * @default -1 (all replicas)
   */
  readonly acks?: -1 | 0 | 1;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  readonly timeout?: number;

  /**
   * Batching configuration
   */
  readonly batch?: {
    /**
     * Max batch size in bytes
     * @default 16384
     */
    readonly size: number;

    /**
     * Linger time in milliseconds
     * @default 10
     */
    readonly lingerMs: number;
  };
}

/**
 * Kafka health check result
 */
export interface KafkaHealthCheck {
  /**
   * Overall health status
   */
  readonly isHealthy: boolean;

  /**
   * Connection status
   */
  readonly connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';

  /**
   * Connected brokers count
   */
  readonly connectedBrokers: number;

  /**
   * Last error message
   */
  readonly lastError?: string;

  /**
   * Producer ready status
   */
  readonly producerReady: boolean;

  /**
   * Consumer ready status
   */
  readonly consumerReady: boolean;
}

/**
 * Default Kafka configuration values
 */
export const DEFAULT_KAFKA_CONFIG: Required<Omit<KafkaConfig, 'brokers' | 'transactionalId' | 'kafkaJSConfig'>> = {
  clientId: 'acme-kafka-client',
  connectionTimeout: 30000,
  requestTimeout: 30000,
  idempotent: true,
  maxInFlightRequests: 5,
  transactional: false,
};

/**
 * Default consumer options
 */
export const DEFAULT_CONSUMER_OPTIONS: Required<Omit<KafkaConsumerOptions, 'groupId' | 'topics'>> = {
  fromBeginning: false,
  autoCommit: false,
  autoCommitInterval: 5000,
  sessionTimeout: 30000,
  rebalanceTimeout: 60000,
  heartbeatInterval: 3000,
  maxBytesPerPartition: 1048576,
  retry: {
    maxRetries: 3,
    initialRetryTime: 1000,
    multiplier: 2,
  },
};

/**
 * Default producer options
 */
export const DEFAULT_PRODUCER_OPTIONS: Required<Omit<KafkaProducerOptions, 'batch'>> = {
  compression: 'gzip',
  acks: -1,
  timeout: 30000,
};
