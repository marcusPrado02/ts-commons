/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Test mocks */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Test mock properties */
/* eslint-disable @typescript-eslint/no-unsafe-call -- Test mock methods */
/* eslint-disable @typescript-eslint/unbound-method -- Vitest mocking pattern */
/* eslint-disable max-lines-per-function -- Test files naturally have longer functions */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Producer, Admin, Kafka, Consumer } from 'kafkajs';
import { KafkaConnection } from './KafkaConnection';
import { KafkaEventPublisher } from './KafkaEventPublisher';
import { KafkaEventConsumer } from './KafkaEventConsumer';
import type { EventEnvelope, EventHandler } from '@acme/messaging';
import type { Logger } from '@acme/observability';

// Mock kafkajs
vi.mock('kafkajs', () => ({
  Kafka: vi.fn(),
  logLevel: {
    ERROR: 1,
    WARN: 2,
    INFO: 4,
    DEBUG: 5,
  },
}));

describe('Kafka Adapter', () => {
  let mockProducer: Partial<Producer>;
  let mockConsumer: Partial<Consumer>;
  let mockAdmin: Partial<Admin>;
  let mockKafka: Partial<Kafka>;
  let mockLogger: Logger;

  beforeEach(async () => {
    mockProducer = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue([{ topicName: 'test', partition: 0, errorCode: 0 }]),
      transaction: vi.fn().mockResolvedValue({
        send: vi.fn().mockResolvedValue(undefined),
        commit: vi.fn().mockResolvedValue(undefined),
        abort: vi.fn().mockResolvedValue(undefined),
      }),
    };

    mockConsumer = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockResolvedValue(undefined),
      run: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      commitOffsets: vi.fn().mockResolvedValue(undefined),
    };

    mockAdmin = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      describeCluster: vi.fn().mockResolvedValue({
        brokers: [{ nodeId: 1, host: 'localhost', port: 9092 }],
      }),
    };

    mockKafka = {
      producer: vi.fn().mockReturnValue(mockProducer),
      consumer: vi.fn().mockReturnValue(mockConsumer),
      admin: vi.fn().mockReturnValue(mockAdmin),
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger;

    // Mock the Kafka constructor
    const kafkajs = await import('kafkajs');
    vi.mocked(kafkajs.Kafka).mockImplementation(() => mockKafka as Kafka);
  });

  describe('KafkaConnection', () => {
    it('should establish connection and initialize producer', async () => {
      const config = {
        brokers: ['localhost:9092'],
        clientId: 'test-client',
      };

      const connection = new KafkaConnection(config, mockLogger);
      await connection.connect();

      expect(mockProducer.connect).toHaveBeenCalled();
      expect(mockAdmin.connect).toHaveBeenCalled();
    });

    it('should return producer instance', async () => {
      const config = {
        brokers: ['localhost:9092'],
      };

      const connection = new KafkaConnection(config, mockLogger);
      await connection.connect();

      const producer = connection.getProducer();
      expect(producer).toBeDefined();
    });

    it('should perform health check', async () => {
      const config = {
        brokers: ['localhost:9092'],
      };

      const connection = new KafkaConnection(config, mockLogger);
      await connection.connect();

      const health = await connection.healthCheck();
      expect(health.isHealthy).toBe(true);
      expect(health.connectionStatus).toBe('connected');
      expect(health.connectedBrokers).toBeGreaterThan(0);
      expect(health.producerReady).toBe(true);
    });

    it('should close all connections', async () => {
      const config = {
        brokers: ['localhost:9092'],
      };

      const connection = new KafkaConnection(config, mockLogger);
      await connection.connect();
      await connection.close();

      expect(mockProducer.disconnect).toHaveBeenCalled();
      expect(mockAdmin.disconnect).toHaveBeenCalled();
    });

    it('should throw error when transactional without transactionalId', () => {
      const config = {
        brokers: ['localhost:9092'],
        transactional: true,
      };

      expect(() => new KafkaConnection(config, mockLogger)).toThrow(
        'transactionalId is required when transactional is true'
      );
    });
  });

  describe('KafkaEventPublisher', () => {
    let connection: KafkaConnection;
    let publisher: KafkaEventPublisher;

    beforeEach(async () => {
      const config = {
        brokers: ['localhost:9092'],
        clientId: 'test-client',
      };

      connection = new KafkaConnection(config, mockLogger);
      await connection.connect();
      publisher = new KafkaEventPublisher(connection, mockLogger);
    });

    it('should publish event to Kafka', async () => {
      const envelope: EventEnvelope<{ userId: string }> = {
        eventId: '123',
        eventType: 'UserCreated',
        eventVersion: '1.0',
        timestamp: new Date().toISOString(),
        correlationId: 'abc',
        payload: { userId: '456' },
      };

      await publisher.publish(envelope);

      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'UserCreated',
          messages: expect.arrayContaining([
            expect.objectContaining({
              key: '123',
              headers: expect.objectContaining({
                'event-id': '123',
                'event-type': 'UserCreated',
                'correlation-id': 'abc',
              }),
            }),
          ]),
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
      };

      await publisher.publish(envelope);

      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              headers: expect.objectContaining({
                'event-type': 'OrderPlaced',
                'event-version': '2.0',
                'tenant-id': 'tenant-1',
                'causation-id': 'causation-1',
              }),
            }),
          ]),
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

      expect(mockProducer.send).toHaveBeenCalledTimes(2);
    });

    it('should use transactions when configured', async () => {
      const transactionalConfig = {
        brokers: ['localhost:9092'],
        transactional: true,
        transactionalId: 'test-tx-1',
      };

      const txConnection = new KafkaConnection(transactionalConfig, mockLogger);
      await txConnection.connect();
      const txPublisher = new KafkaEventPublisher(txConnection, mockLogger);

      const envelope: EventEnvelope<unknown> = {
        eventId: '123',
        eventType: 'OrderCreated',
        eventVersion: '1.0',
        timestamp: new Date().toISOString(),
        payload: {},
      };

      await txPublisher.publish(envelope);

      expect(mockProducer.transaction).toHaveBeenCalled();
    });
  });

  describe('KafkaEventConsumer', () => {
    let connection: KafkaConnection;
    let consumer: KafkaEventConsumer;

    beforeEach(async () => {
      const config = {
        brokers: ['localhost:9092'],
      };

      connection = new KafkaConnection(config, mockLogger);
      await connection.connect();

      consumer = new KafkaEventConsumer(
        connection,
        mockLogger,
        {
          groupId: 'test-group',
          topics: ['UserCreated', 'OrderPlaced'],
        }
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

      expect(mockConsumer.connect).toHaveBeenCalled();
      expect(mockConsumer.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({
          topics: ['UserCreated', 'OrderPlaced'],
        })
      );
      expect(mockConsumer.run).toHaveBeenCalled();
    });

    it('should stop consuming messages', async () => {
      const handler: EventHandler<unknown> = {
        handle: vi.fn().mockResolvedValue(undefined),
      };

      consumer.subscribe('UserCreated', handler);
      await consumer.start();
      await consumer.stop();

      expect(mockConsumer.stop).toHaveBeenCalled();
      expect(mockConsumer.disconnect).toHaveBeenCalled();
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

  describe('Configuration', () => {
    it('should use default configuration values', async () => {
      const config = {
        brokers: ['localhost:9092'],
      };

      const connection = new KafkaConnection(config, mockLogger);
      await connection.connect();

      const actualConfig = connection.getConfig();
      expect(actualConfig.clientId).toBe('acme-kafka-client');
      expect(actualConfig.connectionTimeout).toBe(30000);
      expect(actualConfig.idempotent).toBe(true);
    });

    it('should override default configuration', async () => {
      const config = {
        brokers: ['localhost:9092'],
        clientId: 'custom-client',
        connectionTimeout: 60000,
        idempotent: false,
      };

      const connection = new KafkaConnection(config, mockLogger);
      await connection.connect();

      const actualConfig = connection.getConfig();
      expect(actualConfig.clientId).toBe('custom-client');
      expect(actualConfig.connectionTimeout).toBe(60000);
      expect(actualConfig.idempotent).toBe(false);
    });
  });
});
