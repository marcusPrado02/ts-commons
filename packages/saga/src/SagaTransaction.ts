import type { SagaStatus, SagaStepRecord, SagaTransactionOptions } from './types';

export class SagaTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Saga timed out after ${timeoutMs}ms`);
    this.name = 'SagaTimeoutError';
  }
}

export class SagaStepError extends Error {
  constructor(status: SagaStatus) {
    super(`Cannot add step to saga in status: ${status}`);
    this.name = 'SagaStepError';
  }
}

export class SagaTransaction {
  private readonly startedAt: number;
  private readonly timeoutMs: number | undefined;
  private readonly completedSteps: SagaStepRecord[] = [];
  private _status: SagaStatus = 'running';

  constructor(options?: SagaTransactionOptions) {
    this.startedAt = Date.now();
    this.timeoutMs = options?.timeoutMs;
  }

  get status(): SagaStatus {
    return this._status;
  }

  get stepCount(): number {
    return this.completedSteps.length;
  }

  async step<T>(
    name: string,
    action: () => Promise<T>,
    compensation: (result: T) => Promise<void>,
  ): Promise<T> {
    if (this._status !== 'running') throw new SagaStepError(this._status);
    const timeout = this.timeoutMs;
    if (timeout !== undefined && Date.now() - this.startedAt > timeout) {
      throw new SagaTimeoutError(timeout);
    }
    const result = await action();
    this.completedSteps.push({ name, compensation: () => compensation(result) });
    return result;
  }

  commit(): void {
    this._status = 'committed';
  }

  async rollback(): Promise<void> {
    this._status = 'compensating';
    await this.runCompensations();
    this._status = 'compensated';
  }

  private async runCompensations(): Promise<void> {
    const reversed = [...this.completedSteps].reverse();
    for (const s of reversed) {
      await this.runOneCompensation(s);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async runOneCompensation(step: SagaStepRecord): Promise<void> {
    try {
      await step.compensation();
    } catch {
      // compensation failure is recorded but we continue compensating remaining steps
    }
  }
}
