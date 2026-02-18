/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- Type assertions required for mock objects with exactOptionalPropertyTypes */
/* eslint-disable @typescript-eslint/await-thenable -- Test mocks may have sync methods */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Test mocks */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Test mock properties */
/* eslint-disable @typescript-eslint/no-unsafe-call -- Test mock methods */
/* eslint-disable @typescript-eslint/unbound-method -- Vitest mocking pattern */
/* eslint-disable max-lines-per-function -- Test files naturally have longer functions */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Channel, ChannelModel, Connection } from 'amqplib';
import { RabbitMQConnection } from './RabbitMQConnection';
import { RabbitMQEventPublisher } from './RabbitMQEventPublisher';
import { RabbitMQEventConsumer } from './RabbitMQEventConsumer';
import type { EventEnvelope, EventHandler } from '@acme/messaging';
import type { Logger } from '@acme/observability';

// Mock amqplib
vi.mock('amqplib', () => ({
  connect: vi.fn(),
}));

describe('RabbitMQ Adapter', () => {
  let mockChannel: Partial<Channel>;
  let mockConnection: Partial<Connection>;
  let mockChannelModel: Partial<ChannelModel>;
  let mockLogger: Logger;

  beforeEach(async () => {
    mockChannel = {
      assertExchange: vi.fn().mockResolvedValue(undefined),
      assertQueue: vi.fn().mockResolvedValue({ queue: 'test-queue' }),
      bindQueue: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockReturnValue(true),
      consume: vi.fn().mockResolvedValue({ consumerTag: 'test-consumer' }),
      ack: vi.fn(),
      nack: vi.fn(),
      cancel: vi.fn().mockResolvedValue(undefined),
      prefetch: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockConnection = {
      on: vi.fn(),
    };

    mockChannelModel = {
      createChannel: vi.fn().mockResolvedValue(mockChannel),
      close: vi.fn().mockResolvedValue(undefined),
      connection: mockConnection as Connection,
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger;

    // Mock the connect function
    const amqplib = await import('amqplib');
    vi.mocked(amqplib.connect).mockResolvedValue(mockChannelModel as ChannelModel);
  });

  describe('RabbitMQConnection', () => {
    it('should establish connection and create channel pool', async () => {
      const config = {
        url: 'amqp://localhost',
        exchange: 'test-exchange',
        poolSize: 2,
      };

      const connection = new RabbitMQConnection(config, mockLogger);
      await connection.connect();

      expect(mockChannelModel.createChannel).toHaveBeenCalledTimes(2);
      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'test-exchange',
        'topic',
        { durable: true }
      );
    });

    it('should return channel from pool', async () => {
      const config = {
        url: 'amqp://localhost',
        exchange: 'test-exchange',
        poolSize: 1,
      };

      const connection = new RabbitMQConnection(config, mockLogger);
      await connection.connect();

      const channel = connection.getChannel();
      expect(channel).toBeDefined();
    });

    it('should perform health check', async () => {
      const config = {
        url: 'amqp://localhost',
        exchange: 'test-exchange',
      };

      const connection = new RabbitMQConnection(config, mockLogger);
      await connection.connect();

      const health = connection.healthCheck();
      expect(health.isHealthy).toBe(true);
      expect(health.connectionStatus).toBe('connected');
      expect(health.channelCount).toBeGreaterThan(0);
    });

    it('should close connection and channels', async () => {
      const config = {
        url: 'amqp://localhost',
        exchange: 'test-exchange',
      };

      const connection = new RabbitMQConnection(config, mockLogger);
      await connection.connect();
      await connection.close();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockChannelModel.close).toHaveBeenCalled();
    });
  });

  describe('RabbitMQEventPublisher', () => {
    let connection: RabbitMQConnection;
    let publisher: RabbitMQEventPublisher;

    beforeEach(async () => {
      const config = {
        url: 'amqp://localhost',
        exchange: 'test-exchange',
      };

      connection = new RabbitMQConnection(config, mockLogger);
      await connection.connect();
      publisher = new RabbitMQEventPublisher(connection, mockLogger);
    });

    it('should publish event to RabbitMQ', async () => {
      const envelope: EventEnvelope<{ userId: string }> = {
        eventId: '123',
        eventType: 'UserCreated',
        eventVersion: '1.0',
        timestamp: new Date().toISOString(),
        correlationId: 'abc',
        payload: { userId: '456' },
      };

      await publisher.publish(envelope);

      expect(mockChannel.publish).toHaveBeenCalledWith(
        'test-exchange',
        'UserCreated',
        expect.any(Buffer),
        expect.objectContaining({
          messageId: '123',
          correlationId: 'abc',
          persistent: true,
        })
      );
    });

    it('should include event metadata in headers', async () => {
      const envelope: EventEnvelope<unknown> = {
        eventId: '123',
        eventType: 'OrderPlaced',
        eventVersion: '2.0',
        timestamp: new Date().toISOString(),
        tenantId: 'tenant-1',
        causationId: 'causation-1',
        payload: {},
        metadata: { userId: 'user-1' },
      };

      await publisher.publish(envelope);

      expect(mockChannel.publish).toHaveBeenCalledWith(
        'test-exchange',
        'OrderPlaced',
        expect.any(Buffer),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-event-type': 'OrderPlaced',
            'x-event-version': '2.0',
            'x-tenant-id': 'tenant-1',
            'x-causation-id': 'causation-1',
            userId: 'user-1',
          }),
        })
      );
    });

    it('should publish batch of events', async () => {
      const envelopes: EventEnvelope<unknown>[] = [
        {
          eventId: '1',
          eventType: 'Event1',
          eventVersion: '1.0',
          timestamp: new Date().toISOString(),
          payload: {},
        },
        {
          eventId: '2',
          eventType: 'Event2',
          eventVersion: '1.0',
          timestamp: new Date().toISOString(),
          payload: {},
        },
      ];

      await publisher.publishBatch(envelopes);

      expect(mockChannel.publish).toHaveBeenCalledTimes(2);
    });
  });

  describe('RabbitMQEventConsumer', () => {
    let connection: RabbitMQConnection;
    let consumer: RabbitMQEventConsumer;

    beforeEach(async () => {
      const config = {
        url: 'amqp://localhost',
        exchange: 'test-exchange',
      };

      connection = new RabbitMQConnection(config, mockLogger);
      await connection.connect();

      consumer = new RabbitMQEventConsumer(
        connection,
        mockLogger,
        { queue: 'test-queue', durable: true }
      );
    });

    it('should subscribe to event type', () => {
      const handler: EventHandler<unknown> = {
        handle: vi.fn().mockResolvedValue(undefined),
      };

      consumer.subscribe('UserCreated', handler);

      // No error should be thrown
      expect(true).toBe(true);
    });

    it('should start consuming messages', async () => {
      const handler: EventHandler<unknown> = {
        handle: vi.fn().mockResolvedValue(undefined),
      };

      consumer.subscribe('UserCreated', handler);
      await consumer.start();

      expect(mockChannel.assertQueue).toHaveBeenCalledWith(
        'test-queue',
        expect.objectContaining({ durable: true })
      );
      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        'test-queue',
        'test-exchange',
        'UserCreated'
      );
      expect(mockChannel.consume).toHaveBeenCalled();
    });

    it('should stop consuming messages', async () => {
      const handler: EventHandler<unknown> = {
        handle: vi.fn().mockResolvedValue(undefined),
      };

      consumer.subscribe('UserCreated', handler);
      await consumer.start();
      await consumer.stop();

      expect(mockChannel.cancel).toHaveBeenCalledWith('test-consumer');
    });

    it('should throw error when subscribing after start', async () => {
      const handler: EventHandler<unknown> = {
        handle: vi.fn().mockResolvedValue(undefined),
      };

      consumer.subscribe('UserCreated', handler);
      await consumer.start();

      expect(() => consumer.subscribe('OrderPlaced', handler)).toThrow(
        'Cannot subscribe after consumer is started'
      );
    });

    it('should not throw when stopping already stopped consumer', async () => {
      await consumer.stop();
      // No error should be thrown
      expect(true).toBe(true);
    });
  });

  describe('Dead Letter Queue', () => {
    it('should create DLQ exchange when enabled', async () => {
      const config = {
        url: 'amqp://localhost',
        exchange: 'test-exchange',
        enableDLQ: true,
      };

      const connection = new RabbitMQConnection(config, mockLogger);
      await connection.connect();

      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'test-exchange.dlq',
        'topic',
        { durable: true }
      );
    });

    it('should not create DLQ exchange when disabled', async () => {
      const config = {
        url: 'amqp://localhost',
        exchange: 'test-exchange',
        enableDLQ: false,
      };

      const connection = new RabbitMQConnection(config, mockLogger);
      await connection.connect();

      expect(mockChannel.assertExchange).not.toHaveBeenCalledWith(
        'test-exchange.dlq',
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('Configuration', () => {
    it('should use default configuration values', async () => {
      const config = {
        url: 'amqp://localhost',
        exchange: 'test-exchange',
      };

      const connection = new RabbitMQConnection(config, mockLogger);
      await connection.connect();

      const actualConfig = connection.getConfig();
      expect(actualConfig.poolSize).toBe(5);
      expect(actualConfig.prefetchCount).toBe(10);
      expect(actualConfig.enableDLQ).toBe(true);
      expect(actualConfig.maxRetries).toBe(3);
    });

    it('should override default configuration', async () => {
      const config = {
        url: 'amqp://localhost',
        exchange: 'test-exchange',
        poolSize: 10,
        maxRetries: 5,
      };

      const connection = new RabbitMQConnection(config, mockLogger);
      await connection.connect();

      const actualConfig = connection.getConfig();
      expect(actualConfig.poolSize).toBe(10);
      expect(actualConfig.maxRetries).toBe(5);
    });
  });
});
