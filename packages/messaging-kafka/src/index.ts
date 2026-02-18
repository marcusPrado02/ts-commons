/**
 * @acme/messaging-kafka
 *
 * Apache Kafka adapter for event-driven messaging
 *
 * Features:
 * - Consumer groups for horizontal scaling
 * - Idempotent producer for at-least-once delivery
 * - Optional transactions for exactly-once semantics
 * - Manual offset management
 * - Automatic partition rebalancing
 * - Message deduplication
 *
 * @packageDocumentation
 */

export { KafkaConnection } from './KafkaConnection';
export { KafkaEventPublisher } from './KafkaEventPublisher';
export { KafkaEventConsumer } from './KafkaEventConsumer';
export type {
  KafkaConfig,
  KafkaConsumerOptions,
  KafkaProducerOptions,
  KafkaHealthCheck,
} from './KafkaConfig';
export {
  DEFAULT_KAFKA_CONFIG,
  DEFAULT_CONSUMER_OPTIONS,
  DEFAULT_PRODUCER_OPTIONS,
} from './KafkaConfig';
