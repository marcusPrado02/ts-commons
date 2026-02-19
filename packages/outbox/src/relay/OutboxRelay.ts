import type { EventPublisherPort } from '@acme/messaging';

import type { OutboxStorePort } from '../outbox/OutboxStorePort';
import type { OutboxRelayMetrics } from './OutboxRelayMetrics';

export interface OutboxRelayOptions {
  /** How often to poll the store (ms). Default: 1000. */
  pollIntervalMs?: number;
  /** Maximum messages processed per poll cycle. Default: 100. */
  batchSize?: number;
  /** Number of attempts before a message is moved to the dead-letter queue. Default: 5. */
  maxAttempts?: number;
  /** Base delay (ms) for exponential back-off between retries. Default: 1000. */
  backoffBaseMs?: number;
}

const DEFAULT_OPTIONS: Required<OutboxRelayOptions> = {
  pollIntervalMs: 1000,
  batchSize: 100,
  maxAttempts: 5,
  backoffBaseMs: 1000,
};

/**
 * Polls an {@link OutboxStorePort} and publishes pending messages via an
 * {@link EventPublisherPort}.  Supports exponential back-off, DLQ thresholding,
 * and optional metrics collection.
 */
export class OutboxRelay {
  private readonly resolvedOptions: Required<OutboxRelayOptions>;
  private intervalHandle: ReturnType<typeof setInterval> | undefined;
  private lastRunHadFailures = false;

  constructor(
    private readonly store: OutboxStorePort,
    private readonly publisher: EventPublisherPort,
    options?: OutboxRelayOptions,
    private readonly metrics?: OutboxRelayMetrics,
  ) {
    this.resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Executes a single poll cycle.  Intended for use in tests or on-demand
   * triggers; `start()` calls this on a recurring timer.
   */
  async runOnce(): Promise<void> {
    const messages = await this.store.getUnpublished(this.resolvedOptions.batchSize);
    let hadFailures = false;

    for (const msg of messages) {
      // DLQ: exceeded maximum attempts
      if (msg.attempts >= this.resolvedOptions.maxAttempts) {
        await this.store.markAsFailed(msg.id, 'max attempts exceeded');
        this.metrics?.recordSkipped();
        continue;
      }

      // Exponential back-off: skip if not yet eligible for retry
      if (msg.attempts > 0 && msg.lastAttemptAt !== undefined) {
        const backoffMs = this.resolvedOptions.backoffBaseMs * (2 ** (msg.attempts - 1));
        if (Date.now() < msg.lastAttemptAt.getTime() + backoffMs) {
          continue;
        }
      }

      try {
        await this.publisher.publish(msg.eventEnvelope);
        await this.store.markAsPublished(msg.id);
        this.metrics?.recordPublished();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await this.store.markAsFailed(msg.id, errorMessage);
        this.metrics?.recordFailed();
        hadFailures = true;
      }
    }

    this.lastRunHadFailures = hadFailures;
  }

  /** Starts the recurring poll timer. No-op if already running. */
  start(): void {
    if (this.intervalHandle !== undefined) return;
    this.intervalHandle = setInterval(() => {
      void this.runOnce();
    }, this.resolvedOptions.pollIntervalMs);
  }

  /** Stops the recurring poll timer. No-op if not running. */
  stop(): void {
    if (this.intervalHandle === undefined) return;
    clearInterval(this.intervalHandle);
    this.intervalHandle = undefined;
  }

  /** Returns `true` if the relay is currently polling. */
  isRunning(): boolean {
    return this.intervalHandle !== undefined;
  }

  /** Returns `false` if the most recent poll cycle encountered any publish failures. */
  isHealthy(): boolean {
    return !this.lastRunHadFailures;
  }
}
