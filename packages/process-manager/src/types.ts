/**
 * Lifecycle status of a managed process.
 */
export type ProcessStatus = 'idle' | 'running' | 'completed' | 'failed' | 'timed-out';

/**
 * Persistent state envelope stored for every managed process.
 */
export interface ProcessState<TState = unknown> {
  readonly id: string;
  readonly name: string;
  status: ProcessStatus;
  currentState: TState;
  startedAt: Date;
  updatedAt: Date;
  correlationId?: string;
  timeoutAt?: Date;
  error?: unknown;
}

/**
 * A single allowed state-machine transition.
 */
export interface TransitionRule<TState> {
  readonly from: TState;
  readonly to: TState;
}

/**
 * Aggregate metrics reported by ProcessMonitor.
 */
export interface ProcessMetrics {
  started: number;
  completed: number;
  failed: number;
  timedOut: number;
}

/**
 * Process lifecycle event recorded by ProcessMonitor.
 */
export interface ProcessEvent {
  readonly processId: string;
  readonly type: 'started' | 'completed' | 'failed' | 'timed-out';
  readonly timestamp: Date;
  readonly error?: string;
}

/**
 * Persistence contract for process states.
 */
export interface ProcessStore<TState = unknown> {
  save(state: ProcessState<TState>): Promise<void>;
  findById(id: string): Promise<ProcessState<TState> | undefined>;
  findByCorrelationId(correlationId: string): Promise<ProcessState<TState> | undefined>;
  findByStatus(status: ProcessStatus): Promise<ProcessState<TState>[]>;
  delete(id: string): Promise<void>;
  size(): number;
}
