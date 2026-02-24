export type SagaStatus =
  | 'pending'
  | 'running'
  | 'committed'
  | 'compensating'
  | 'compensated'
  | 'failed';

export interface SagaResult<T> {
  success: boolean;
  value?: T;
  error?: unknown;
}

export interface SagaState {
  id: string;
  name: string;
  status: SagaStatus;
  startedAt: Date;
  updatedAt: Date;
  completedSteps: number;
  error?: string;
}

export interface SagaStepRecord {
  name: string;
  compensation: () => Promise<void>;
}

export interface SagaTransactionOptions {
  timeoutMs?: number;
}

export interface SagaMetrics {
  started: number;
  committed: number;
  compensated: number;
  failed: number;
}

export interface ChoreographyEvent {
  type: string;
  payload: unknown;
  sagaId: string;
  timestamp: Date;
}

export type ChoreographyHandler = (event: ChoreographyEvent) => Promise<void>;

export interface SagaEventRecord {
  sagaId: string;
  event: string;
  timestamp: Date;
  error?: string;
}
