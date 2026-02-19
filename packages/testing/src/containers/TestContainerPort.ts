/**
 * Generic port for a pre-configured test container.
 *
 * Concrete implementations may wrap the `testcontainers` npm package,
 * Docker Compose, or any other container runtime.  The library also ships
 * with a {@link FakeTestContainer} for unit-test scenarios where a real
 * container is not available.
 */
export interface TestContainerPort<TConnectionInfo> {
  /** Starts the container and makes it ready for connections. */
  start(): Promise<void>;
  /** Stops and removes the container. */
  stop(): Promise<void>;
  /**
   * Returns connection information for the running container.
   * @throws if called before `start()` has resolved successfully.
   */
  getConnectionInfo(): TConnectionInfo;
  /** Returns `true` while the container is running. */
  isRunning(): boolean;
}

// ─── Connection info types ─────────────────────────────────────────────────

export interface PostgresConnectionInfo {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  /** Convenience URL: `postgresql://user:pass@host:port/db` */
  readonly url: string;
}

export interface MysqlConnectionInfo {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly url: string;
}

export interface MongoConnectionInfo {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  /** Convenience URL: `mongodb://host:port/db` */
  readonly url: string;
}

export interface RedisConnectionInfo {
  readonly host: string;
  readonly port: number;
  /** Convenience URL: `redis://host:port` */
  readonly url: string;
}

export interface RabbitMqConnectionInfo {
  readonly host: string;
  readonly amqpPort: number;
  readonly managementPort: number;
  readonly username: string;
  readonly password: string;
  readonly url: string;
}

export interface KafkaConnectionInfo {
  readonly bootstrapServers: string;
  readonly host: string;
  readonly port: number;
}

export interface LocalStackConnectionInfo {
  readonly endpoint: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}
