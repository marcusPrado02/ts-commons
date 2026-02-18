/**
 * AWS EventBridge connection and publisher configuration
 */
export interface EventBridgeConfig {
  /**
   * AWS region
   * @example 'us-east-1'
   */
  readonly region: string;

  /**
   * EventBridge event bus name or ARN
   * @default 'default'
   */
  readonly eventBusName?: string;

  /**
   * Source identifier for events (your application/service name)
   * @example 'com.myapp.orders'
   */
  readonly source: string;

  /**
   * Custom endpoint URL (useful for LocalStack in tests)
   * @example 'http://localhost:4566'
   */
  readonly endpoint?: string;

  /**
   * AWS access key ID (optional – uses default credential chain if omitted)
   */
  readonly accessKeyId?: string;

  /**
   * AWS secret access key (optional – uses default credential chain if omitted)
   */
  readonly secretAccessKey?: string;

  /**
   * AWS session token (optional, for temporary credentials)
   */
  readonly sessionToken?: string;

  /**
   * Maximum number of events per PutEvents batch (AWS limit: 10)
   * @default 10
   */
  readonly maxBatchSize?: number;

  /**
   * Retry attempts on transient AWS errors
   * @default 3
   */
  readonly maxRetries?: number;
}

/**
 * SQS consumer configuration for consuming EventBridge events
 * via an SQS target rule
 */
export interface EventBridgeSQSConsumerConfig {
  /**
   * AWS region
   */
  readonly region: string;

  /**
   * SQS queue URL that receives EventBridge events
   * @example 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue'
   */
  readonly queueUrl: string;

  /**
   * Custom endpoint URL (useful for LocalStack in tests)
   */
  readonly endpoint?: string;

  /**
   * AWS access key ID (optional)
   */
  readonly accessKeyId?: string;

  /**
   * AWS secret access key (optional)
   */
  readonly secretAccessKey?: string;

  /**
   * AWS session token (optional)
   */
  readonly sessionToken?: string;

  /**
   * Number of messages to fetch per poll
   * @default 10
   */
  readonly maxMessages?: number;

  /**
   * Long-polling wait time in seconds (0-20)
   * @default 20
   */
  readonly waitTimeSeconds?: number;

  /**
   * Visibility timeout in seconds (how long a message is hidden after receive)
   * @default 30
   */
  readonly visibilityTimeout?: number;

  /**
   * Polling interval in milliseconds when no messages are received
   * @default 1000
   */
  readonly pollingIntervalMs?: number;
}

/**
 * EventBridge health check status
 */
export interface EventBridgeHealthCheck {
  readonly connected: boolean;
  readonly region: string;
  readonly eventBusName: string;
  readonly lastError: string | undefined;
  readonly publishedCount: number;
  readonly errorCount: number;
}

/**
 * Default EventBridge configuration values
 */
export const DEFAULT_EVENTBRIDGE_CONFIG = {
  eventBusName: 'default',
  maxBatchSize: 10,
  maxRetries: 3,
} as const satisfies Partial<EventBridgeConfig>;

/**
 * Default SQS consumer configuration values
 */
export const DEFAULT_SQS_CONSUMER_CONFIG = {
  maxMessages: 10,
  waitTimeSeconds: 20,
  visibilityTimeout: 30,
  pollingIntervalMs: 1000,
} as const satisfies Partial<EventBridgeSQSConsumerConfig>;
