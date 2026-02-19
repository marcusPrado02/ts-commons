export class BulkheadRejectedError extends Error {
  constructor() {
    super('Bulkhead queue is full — request rejected');
    this.name = 'BulkheadRejectedError';
  }
}

/**
 * Bulkhead pattern: limits concurrent executions and queues overflow.
 * Rejects immediately when queue capacity is exhausted.
 */
export class Bulkhead {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueue: number,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquireSlot();
    try {
      return await fn();
    } finally {
      this.releaseSlot();
    }
  }

  private acquireSlot(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return Promise.resolve();
    }

    if (this.queue.length >= this.maxQueue) {
      return Promise.reject(new BulkheadRejectedError());
    }

    return new Promise<void>(resolve => {
      this.queue.push(resolve);
    });
  }

  private releaseSlot(): void {
    const next = this.queue.shift();
    if (next !== undefined) {
      // Transfer slot directly to the next queued waiter
      next();
    } else {
      this.active--;
    }
  }

  getActiveCount(): number {
    return this.active;
  }

  getQueueSize(): number {
    return this.queue.length;
  }
}
