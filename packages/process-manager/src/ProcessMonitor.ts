import type { ProcessMetrics, ProcessEvent } from './types.js';

/**
 * Observability component that records process lifecycle events and
 * accumulates aggregate metrics.
 */
export class ProcessMonitor {
  private metrics: ProcessMetrics = {
    started: 0,
    completed: 0,
    failed: 0,
    timedOut: 0,
  };

  private readonly events: ProcessEvent[] = [];

  onStarted(processId: string): void {
    this.metrics.started++;
    this.events.push({ processId, type: 'started', timestamp: new Date() });
  }

  onCompleted(processId: string): void {
    this.metrics.completed++;
    this.events.push({ processId, type: 'completed', timestamp: new Date() });
  }

  onFailed(processId: string, error?: unknown): void {
    this.metrics.failed++;
    let errorMsg: string | undefined;
    if (error instanceof Error) {
      errorMsg = error.message;
    } else if (error !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      errorMsg = String(error);
    }
    const event: ProcessEvent =
      errorMsg !== undefined
        ? { processId, type: 'failed', timestamp: new Date(), error: errorMsg }
        : { processId, type: 'failed', timestamp: new Date() };
    this.events.push(event);
  }

  onTimedOut(processId: string): void {
    this.metrics.timedOut++;
    this.events.push({ processId, type: 'timed-out', timestamp: new Date() });
  }

  /** Returns a snapshot copy of current metrics. */
  getMetrics(): ProcessMetrics {
    return { ...this.metrics };
  }

  /** Returns a readonly copy of recorded lifecycle events. */
  getEvents(): readonly ProcessEvent[] {
    return structuredClone(this.events);
  }

  /** Reset all counters and event history. */
  reset(): void {
    this.metrics = { started: 0, completed: 0, failed: 0, timedOut: 0 };
    this.events.length = 0;
  }
}
