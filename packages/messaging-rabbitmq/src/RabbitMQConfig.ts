/**
 * RabbitMQ configuration
 */
export interface RabbitMQConfig {
  /** Connection URL (amqp://user:pass@host:port/vhost) */
  url: string;

  /** Exchange name for publishing events */
  exchange: string;

  /** Exchange type (topic, direct, fanout, headers) */
  exchangeType?: 'topic' | 'direct' | 'fanout' | 'headers';

  /** Connection pool size */
  poolSize?: number;

  /** Connection timeout in milliseconds */
  connectionTimeout?: number;

  /** Heartbeat interval in seconds */
  heartbeat?: number;

  /** Prefetch count for consumers */
  prefetchCount?: number;

  /** Enable dead letter queue */
  enableDLQ?: boolean;

  /** Dead letter exchange suffix */
  dlqExchangeSuffix?: string;

  /** Dead letter queue suffix */
  dlqQueueSuffix?: string;

  /** Max retry attempts before sending to DLQ */
  maxRetries?: number;

  /** Retry delay in milliseconds */
  retryDelay?: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_RABBITMQ_CONFIG: Partial<RabbitMQConfig> = {
  exchangeType: 'topic',
  poolSize: 5,
  connectionTimeout: 30000,
  heartbeat: 60,
  prefetchCount: 10,
  enableDLQ: true,
  dlqExchangeSuffix: '.dlq',
  dlqQueueSuffix: '.dlq',
  maxRetries: 3,
  retryDelay: 5000,
};

/**
 * Message properties for RabbitMQ
 */
export interface RabbitMQMessageProperties {
  messageId: string;
  correlationId?: string;
  timestamp?: number;
  headers?: Record<string, unknown>;
  expiration?: string;
  priority?: number;
}

/**
 * Consumer options
 */
export interface RabbitMQConsumerOptions {
  queue: string;
  routingKey?: string;
  autoAck?: boolean;
  exclusive?: boolean;
  durable?: boolean;
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Health check result
 */
export interface RabbitMQHealthCheck {
  isHealthy: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  channelCount: number;
  lastError?: string;
}
