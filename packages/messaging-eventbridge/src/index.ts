/**
 * @acme/messaging-eventbridge
 *
 * AWS EventBridge adapter for event-driven messaging.
 *
 * Provides:
 * - EventBridgeEventPublisher: publish events to an EventBridge bus
 * - EventBridgeEventConsumer: consume events via SQS polling (EventBridge → SQS target)
 * - EventBridgeConnection: manage the AWS SDK client lifecycle
 */

// Configuration
export type {
  EventBridgeConfig,
  EventBridgeSQSConsumerConfig,
  EventBridgeHealthCheck,
} from './EventBridgeConfig';
export {
  DEFAULT_EVENTBRIDGE_CONFIG,
  DEFAULT_SQS_CONSUMER_CONFIG,
} from './EventBridgeConfig';

// Connection
export { EventBridgeConnection } from './EventBridgeConnection';

// Publisher
export { EventBridgeEventPublisher } from './EventBridgeEventPublisher';

// Consumer
export { EventBridgeEventConsumer } from './EventBridgeEventConsumer';
