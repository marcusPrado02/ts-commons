import type { SagaMetrics, SagaEventRecord } from './types';

export class SagaMonitor {
  private metrics: SagaMetrics = { started: 0, committed: 0, compensated: 0, failed: 0 };
  private readonly events: SagaEventRecord[] = [];

  onSagaStarted(sagaId: string): void {
    this.metrics = { ...this.metrics, started: this.metrics.started + 1 };
    this.events.push({ sagaId, event: 'started', timestamp: new Date() });
  }

  onSagaCommitted(sagaId: string): void {
    this.metrics = { ...this.metrics, committed: this.metrics.committed + 1 };
    this.events.push({ sagaId, event: 'committed', timestamp: new Date() });
  }

  onSagaCompensated(sagaId: string): void {
    this.metrics = { ...this.metrics, compensated: this.metrics.compensated + 1 };
    this.events.push({ sagaId, event: 'compensated', timestamp: new Date() });
  }

  onSagaFailed(sagaId: string, error: unknown): void {
    const errorMsg = error instanceof Error ? error.message : String(error);
    this.metrics = { ...this.metrics, failed: this.metrics.failed + 1 };
    this.events.push({ sagaId, event: 'failed', timestamp: new Date(), error: errorMsg });
  }

  getMetrics(): Readonly<SagaMetrics> {
    return { ...this.metrics };
  }

  getEvents(): readonly SagaEventRecord[] {
    return [...this.events];
  }

  reset(): void {
    this.metrics = { started: 0, committed: 0, compensated: 0, failed: 0 };
    this.events.length = 0;
  }
}
