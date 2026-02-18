/* eslint-disable @typescript-eslint/no-unsafe-assignment -- vi.mock returns any */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- mock types */
/* eslint-disable @typescript-eslint/no-explicit-any -- mock flexibility */
/* eslint-disable @typescript-eslint/unbound-method -- Vitest mocking pattern */
/* eslint-disable @typescript-eslint/explicit-function-return-type -- test helper functions */
/* eslint-disable max-lines-per-function -- test suites naturally have longer functions */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Logger } from '@acme/observability';

// ── Hoisted mock functions (available before vi.mock factories run) ───────────

const { mockEBSend, mockEBDestroy, mockSQSSend, mockSQSDestroy } = vi.hoisted(() => ({
  mockEBSend: vi.fn(),
  mockEBDestroy: vi.fn(),
  mockSQSSend: vi.fn(),
  mockSQSDestroy: vi.fn(),
}));

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: vi.fn().mockImplementation(() => ({
    send: mockEBSend,
    destroy: mockEBDestroy,
  })),
  DescribeEventBusCommand: vi.fn().mockImplementation((params: unknown) => ({
    __type: 'DescribeEventBusCommand',
    params,
  })),
  PutEventsCommand: vi.fn().mockImplementation((params: unknown) => ({
    __type: 'PutEventsCommand',
    params,
  })),
}));

vi.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: vi.fn().mockImplementation(() => ({
    send: mockSQSSend,
    destroy: mockSQSDestroy,
  })),
  ReceiveMessageCommand: vi.fn().mockImplementation((params: unknown) => ({
    __type: 'ReceiveMessageCommand',
    params,
  })),
  DeleteMessageCommand: vi.fn().mockImplementation((params: unknown) => ({
    __type: 'DeleteMessageCommand',
    params,
  })),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import * as awsEventBridge from '@aws-sdk/client-eventbridge';
import * as awsSqs from '@aws-sdk/client-sqs';
import {
  EventBridgeConnection,
  EventBridgeEventPublisher,
  EventBridgeEventConsumer,
  DEFAULT_EVENTBRIDGE_CONFIG,
  DEFAULT_SQS_CONSUMER_CONFIG,
} from './index';
import type { EventBridgeConfig, EventBridgeSQSConsumerConfig } from './index';

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;

const baseConfig: EventBridgeConfig = {
  region: 'us-east-1',
  eventBusName: 'test-bus',
  source: 'com.acme.test',
  endpoint: 'http://localhost:4566',
  accessKeyId: 'test',
  secretAccessKey: 'test',
};

const sqsConfig: EventBridgeSQSConsumerConfig = {
  region: 'us-east-1',
  queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
  endpoint: 'http://localhost:4566',
  accessKeyId: 'test',
  secretAccessKey: 'test',
  pollingIntervalMs: 50,
  waitTimeSeconds: 0,
};

function makeEnvelope(overrides = {}) {
  return {
    eventId: 'evt-001',
    eventType: 'OrderCreated',
    eventVersion: '1.0',
    timestamp: '2026-01-01T00:00:00.000Z',
    correlationId: 'corr-001',
    payload: { orderId: '123' },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EventBridgeConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should connect successfully and verify event bus', async () => {
    const connection = new EventBridgeConnection(baseConfig, mockLogger);
    mockEBSend.mockResolvedValueOnce({ EventBus: { Name: 'test-bus' } });

    await connection.connect();

    expect(connection.connected).toBe(true);
    expect(mockEBSend).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Connected to AWS EventBridge successfully',
      expect.objectContaining({ region: 'us-east-1' }),
    );
  });

  it('should throw and log when connection fails', async () => {
    const connection = new EventBridgeConnection(baseConfig, mockLogger);
    mockEBSend.mockRejectedValueOnce(new Error('Network error'));

    await expect(connection.connect()).rejects.toThrow('Network error');
    expect(connection.connected).toBe(false);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should return health check as connected', async () => {
    const connection = new EventBridgeConnection(baseConfig, mockLogger);
    mockEBSend.mockResolvedValue({ EventBus: { Name: 'test-bus' } });

    await connection.connect();
    const health = await connection.healthCheck();

    expect(health.connected).toBe(true);
    expect(health.region).toBe('us-east-1');
    expect(health.eventBusName).toBe('test-bus');
    expect(health.lastError).toBeUndefined();
  });

  it('should return unhealthy when client is not initialized', async () => {
    const connection = new EventBridgeConnection(baseConfig, mockLogger);
    const health = await connection.healthCheck();

    expect(health.connected).toBe(false);
    expect(health.lastError).toBe('Client not initialized');
  });

  it('should close and destroy the client', async () => {
    const connection = new EventBridgeConnection(baseConfig, mockLogger);
    mockEBSend.mockResolvedValueOnce({});
    await connection.connect();

    await connection.close();

    expect(mockEBDestroy).toHaveBeenCalledTimes(1);
    expect(connection.connected).toBe(false);
  });
});

describe('EventBridgeEventPublisher', () => {
  let connection: EventBridgeConnection;

  beforeEach(async () => {
    vi.clearAllMocks();
    connection = new EventBridgeConnection(baseConfig, mockLogger);
    mockEBSend.mockResolvedValueOnce({});
    await connection.connect();
    mockEBSend.mockClear(); // Reset call count to 0 after connect setup
  });

  it('should publish a single event successfully', async () => {
    const publisher = new EventBridgeEventPublisher(connection, mockLogger);
    mockEBSend.mockResolvedValueOnce({ FailedEntryCount: 0, Entries: [{ EventId: 'aws-id' }] });

    await publisher.publish(makeEnvelope());

    expect(mockEBSend).toHaveBeenCalled();
    expect(awsEventBridge.PutEventsCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Entries: expect.arrayContaining([
          expect.objectContaining({
            Source: 'com.acme.test',
            DetailType: 'OrderCreated',
          }),
        ]),
      }),
    );
  });

  it('should throw when EventBridge returns failed entries', async () => {
    const publisher = new EventBridgeEventPublisher(connection, mockLogger);
    mockEBSend.mockResolvedValueOnce({
      FailedEntryCount: 1,
      Entries: [{ ErrorCode: 'ThrottlingException', ErrorMessage: 'Rate exceeded' }],
    });

    await expect(publisher.publish(makeEnvelope())).rejects.toThrow(
      'EventBridge rejected event',
    );
  });

  it('should publish a batch split across multiple PutEvents calls', async () => {
    const publisher = new EventBridgeEventPublisher(connection, mockLogger);
    mockEBSend.mockResolvedValue({ FailedEntryCount: 0, Entries: [] });

    const envelopes = Array.from({ length: 15 }, (_, i) =>
      makeEnvelope({ eventId: `evt-${i}` }),
    );
    await publisher.publishBatch(envelopes);

    // Should have called send twice: first 10, then 5
    expect(mockEBSend).toHaveBeenCalledTimes(2);
  });

  it('should do nothing when publishBatch receives an empty array', async () => {
    const publisher = new EventBridgeEventPublisher(connection, mockLogger);

    await publisher.publishBatch([]);

    expect(mockEBSend).not.toHaveBeenCalled();
  });
});

describe('EventBridgeEventConsumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register handlers and start polling', async () => {
    const consumer = new EventBridgeEventConsumer(sqsConfig, mockLogger);
    mockSQSSend.mockResolvedValue({ Messages: [] });

    const handler = { handle: vi.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    consumer.subscribe('OrderCreated', handler);

    await consumer.start();
    await new Promise((r) => setTimeout(r, 30));
    await consumer.stop();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'EventBridge SQS consumer started',
      expect.objectContaining({ queueUrl: sqsConfig.queueUrl }),
    );
  });

  it('should dispatch event to registered handler and delete message', async () => {
    const consumer = new EventBridgeEventConsumer(sqsConfig, mockLogger);

    const sqsBody = JSON.stringify({
      version: '0',
      id: 'aws-event-id',
      'detail-type': 'OrderCreated',
      source: 'com.acme.test',
      detail: {
        eventId: 'evt-dispatch-01',
        eventVersion: '1.0',
        timestamp: '2026-01-01T00:00:00.000Z',
        payload: { orderId: '42' },
      },
    });

    mockSQSSend
      .mockResolvedValueOnce({
        Messages: [{ Body: sqsBody, ReceiptHandle: 'rh-1' }],
      })
      .mockResolvedValue({ Messages: [] });

    const handler = { handle: vi.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    consumer.subscribe('OrderCreated', handler);

    await consumer.start();
    await new Promise((r) => setTimeout(r, 80));
    await consumer.stop();

    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(handler.handle).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt-dispatch-01', eventType: 'OrderCreated' }),
    );
    // DeleteMessageCommand should be called for acknowledge
    expect(awsSqs.DeleteMessageCommand).toHaveBeenCalled();
  });

  it('should deduplicate repeated events', async () => {
    const consumer = new EventBridgeEventConsumer(sqsConfig, mockLogger);

    const sqsBody = JSON.stringify({
      version: '0',
      id: 'aws-id',
      'detail-type': 'OrderCreated',
      source: 'com.acme.test',
      detail: { eventId: 'evt-dedup-01', eventVersion: '1.0', timestamp: '2026-01-01T00:00:00.000Z', payload: {} },
    });

    mockSQSSend
      .mockResolvedValueOnce({ Messages: [{ Body: sqsBody, ReceiptHandle: 'rh-a' }] })
      .mockResolvedValueOnce({ Messages: [{ Body: sqsBody, ReceiptHandle: 'rh-b' }] })
      .mockResolvedValue({ Messages: [] });

    const handler = { handle: vi.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    consumer.subscribe('OrderCreated', handler);

    await consumer.start();
    await new Promise((r) => setTimeout(r, 150));
    await consumer.stop();

    expect(handler.handle).toHaveBeenCalledTimes(1);
  });

  it('should skip messages with no registered handler', async () => {
    const consumer = new EventBridgeEventConsumer(sqsConfig, mockLogger);

    const sqsBody = JSON.stringify({
      version: '0',
      id: 'aws-id',
      'detail-type': 'UnknownEvent',
      source: 'com.acme.test',
      detail: { eventId: 'evt-unknown', eventVersion: '1.0', timestamp: '2026-01-01T00:00:00.000Z', payload: {} },
    });

    mockSQSSend
      .mockResolvedValueOnce({ Messages: [{ Body: sqsBody, ReceiptHandle: 'rh-skip' }] })
      .mockResolvedValue({ Messages: [] });

    const handler = { handle: vi.fn<() => Promise<void>>() };
    consumer.subscribe('OrderCreated', handler);

    await consumer.start();
    await new Promise((r) => setTimeout(r, 80));
    await consumer.stop();

    expect(handler.handle).not.toHaveBeenCalled();
  });

  it('should not delete message when handler throws', async () => {
    const consumer = new EventBridgeEventConsumer(sqsConfig, mockLogger);

    const sqsBody = JSON.stringify({
      version: '0',
      id: 'aws-id',
      'detail-type': 'OrderCreated',
      source: 'com.acme.test',
      detail: { eventId: 'evt-fail', eventVersion: '1.0', timestamp: '2026-01-01T00:00:00.000Z', payload: {} },
    });

    mockSQSSend
      .mockResolvedValueOnce({ Messages: [{ Body: sqsBody, ReceiptHandle: 'rh-fail' }] })
      .mockResolvedValue({ Messages: [] });

    const handler = {
      handle: vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error('Handler failure')),
    };
    consumer.subscribe('OrderCreated', handler);

    await consumer.start();
    await new Promise((r) => setTimeout(r, 80));
    await consumer.stop();

    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error processing EventBridge event',
      expect.any(Error),
      expect.objectContaining({ eventId: 'evt-fail' }),
    );
  });
});

describe('Configuration defaults', () => {
  it('should have correct DEFAULT_EVENTBRIDGE_CONFIG', () => {
    expect(DEFAULT_EVENTBRIDGE_CONFIG.eventBusName).toBe('default');
    expect(DEFAULT_EVENTBRIDGE_CONFIG.maxBatchSize).toBe(10);
    expect(DEFAULT_EVENTBRIDGE_CONFIG.maxRetries).toBe(3);
  });

  it('should have correct DEFAULT_SQS_CONSUMER_CONFIG', () => {
    expect(DEFAULT_SQS_CONSUMER_CONFIG.maxMessages).toBe(10);
    expect(DEFAULT_SQS_CONSUMER_CONFIG.waitTimeSeconds).toBe(20);
    expect(DEFAULT_SQS_CONSUMER_CONFIG.visibilityTimeout).toBe(30);
    expect(DEFAULT_SQS_CONSUMER_CONFIG.pollingIntervalMs).toBe(1000);
  });
});
