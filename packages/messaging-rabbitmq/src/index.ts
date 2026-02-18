/**
 * RabbitMQ adapter for event-driven messaging
 *
 * @packageDocumentation
 */

// Configuration
export type {
  RabbitMQConfig,
  RabbitMQMessageProperties,
  RabbitMQConsumerOptions,
  RabbitMQHealthCheck,
} from './RabbitMQConfig';
export { DEFAULT_RABBITMQ_CONFIG } from './RabbitMQConfig';

// Connection
export { RabbitMQConnection } from './RabbitMQConnection';

// Publisher
export { RabbitMQEventPublisher } from './RabbitMQEventPublisher';

// Consumer
export { RabbitMQEventConsumer } from './RabbitMQEventConsumer';
