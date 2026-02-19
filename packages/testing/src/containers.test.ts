/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, beforeEach } from 'vitest';
import type {
  PostgresConnectionInfo,
  MongoConnectionInfo,
  RedisConnectionInfo,
  KafkaConnectionInfo,
} from './containers/TestContainerPort';
import { ContainerTestHarness } from './containers/ContainerTestHarness';
import { CompositeSeeder } from './containers/Seeder';
import type { Seeder } from './containers/Seeder';
import { FakeTestContainer } from './containers/FakeTestContainer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makePostgresInfo = (): PostgresConnectionInfo => ({
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  username: 'admin',
  password: 'secret',
  url: 'postgresql://admin:secret@localhost:5432/testdb',
});

const makeMongoInfo = (): MongoConnectionInfo => ({
  host: 'localhost',
  port: 27017,
  database: 'testdb',
  url: 'mongodb://localhost:27017/testdb',
});

const makeRedisInfo = (): RedisConnectionInfo => ({
  host: 'localhost',
  port: 6379,
  url: 'redis://localhost:6379',
});

const makeKafkaInfo = (): KafkaConnectionInfo => ({
  host: 'localhost',
  port: 9092,
  bootstrapServers: 'localhost:9092',
});

// ─── Connection info types ─────────────────────────────────────────────────────

describe('Connection info types', () => {
  it('PostgresConnectionInfo has all required fields and a url', () => {
    const info = makePostgresInfo();
    expect(info.host).toBe('localhost');
    expect(info.port).toBe(5432);
    expect(info.database).toBe('testdb');
    expect(info.url).toContain('postgresql://');
  });

  it('MongoConnectionInfo url follows mongodb:// scheme', () => {
    const info = makeMongoInfo();
    expect(info.url).toMatch(/^mongodb:\/\//);
    expect(info.database).toBe('testdb');
  });

  it('RedisConnectionInfo url follows redis:// scheme', () => {
    const info = makeRedisInfo();
    expect(info.url).toMatch(/^redis:\/\//);
    expect(info.port).toBe(6379);
  });

  it('KafkaConnectionInfo exposes bootstrapServers as host:port string', () => {
    const info = makeKafkaInfo();
    expect(info.bootstrapServers).toBe('localhost:9092');
  });
});

// ─── FakeTestContainer ─────────────────────────────────────────────────────────

describe('FakeTestContainer', () => {
  let container: FakeTestContainer<RedisConnectionInfo>;

  beforeEach(() => {
    container = new FakeTestContainer<RedisConnectionInfo>(makeRedisInfo());
  });

  it('isRunning() is false before start()', () => {
    expect(container.isRunning()).toBe(false);
  });

  it('start() resolves and sets isRunning() to true', async () => {
    await container.start();
    expect(container.isRunning()).toBe(true);
  });

  it('getConnectionInfo() returns the configured connection info after start()', async () => {
    await container.start();
    const info = container.getConnectionInfo();
    expect(info.url).toBe('redis://localhost:6379');
  });

  it('stop() resolves and sets isRunning() to false', async () => {
    await container.start();
    await container.stop();
    expect(container.isRunning()).toBe(false);
  });

  it('getConnectionInfo() throws when the container is not running', () => {
    expect(() => container.getConnectionInfo()).toThrow(/not running/);
  });

  it('simulateFailure() makes start() reject with the given error', async () => {
    container.simulateFailure(new Error('Docker not available'));
    await expect(container.start()).rejects.toThrow('Docker not available');
  });
});

// ─── ContainerTestHarness ──────────────────────────────────────────────────────

describe('ContainerTestHarness', () => {
  let harness: ContainerTestHarness;
  let pgContainer: FakeTestContainer<PostgresConnectionInfo>;
  let mongoContainer: FakeTestContainer<MongoConnectionInfo>;

  beforeEach(() => {
    harness = new ContainerTestHarness();
    pgContainer = new FakeTestContainer<PostgresConnectionInfo>(makePostgresInfo());
    mongoContainer = new FakeTestContainer<MongoConnectionInfo>(makeMongoInfo());
  });

  it('setupAll() starts all registered containers', async () => {
    harness.register('pg', pgContainer).register('mongo', mongoContainer);
    await harness.setupAll();
    expect(pgContainer.isRunning()).toBe(true);
    expect(mongoContainer.isRunning()).toBe(true);
  });

  it('teardownAll() stops all containers and sets isStarted() to false', async () => {
    harness.register('pg', pgContainer);
    await harness.setupAll();
    await harness.teardownAll();
    expect(harness.isStarted()).toBe(false);
    expect(pgContainer.isRunning()).toBe(false);
  });

  it('getContainer() returns the container previously registered under the given name', async () => {
    harness.register('redis', new FakeTestContainer<RedisConnectionInfo>(makeRedisInfo()));
    await harness.setupAll();
    const c = harness.getContainer<RedisConnectionInfo>('redis');
    expect(c.getConnectionInfo().url).toBe('redis://localhost:6379');
  });

  it('isStarted() is false before setupAll() and true after', async () => {
    harness.register('pg', pgContainer);
    expect(harness.isStarted()).toBe(false);
    await harness.setupAll();
    expect(harness.isStarted()).toBe(true);
  });

  it('getContainer() throws for an unregistered name', () => {
    expect(() => harness.getContainer('unknown')).toThrow(/No container registered/);
  });
});

// ─── CompositeSeeder ───────────────────────────────────────────────────────────

describe('CompositeSeeder', () => {
  it('seed() on an empty composite resolves without calling anything', async () => {
    const composite = new CompositeSeeder();
    await expect(composite.seed()).resolves.toBeUndefined();
    expect(composite.size()).toBe(0);
  });

  it('seed() runs all registered seeders in the order they were added', async () => {
    const order: number[] = [];
    const makeSeeder = (n: number): Seeder => ({
      seed: () => {
        order.push(n);
        return Promise.resolve();
      },
    });

    const composite = new CompositeSeeder().add(makeSeeder(1)).add(makeSeeder(2)).add(makeSeeder(3));
    await composite.seed();
    expect(order).toEqual([1, 2, 3]);
  });

  it('seed() propagates an error thrown by a child seeder', async () => {
    const failingSeeder: Seeder = { seed: () => Promise.reject(new Error('DB unavailable')) };
    const composite = new CompositeSeeder().add(failingSeeder);
    await expect(composite.seed()).rejects.toThrow('DB unavailable');
  });

  it('add() returns the same CompositeSeeder instance for fluent chaining', () => {
    const composite = new CompositeSeeder();
    const seeder: Seeder = { seed: () => Promise.resolve() };
    const returned = composite.add(seeder);
    expect(returned).toBe(composite);
    expect(composite.size()).toBe(1);
  });
});
