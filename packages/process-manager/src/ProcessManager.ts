import type { ProcessState, ProcessStatus } from './types.js';
import type { StateMachine } from './StateMachine.js';
export { InvalidTransitionError } from './StateMachine.js';

/**
 * Abstract base class for Process Managers.
 *
 * A Process Manager coordinates a long-running business process that spans
 * multiple events and commands. It holds a state machine, manages process
 * lifecycle transitions and delegates persistence/observability to the
 * concrete subclass via protected hooks.
 *
 * @typeParam TState  The domain-specific state enum / union type.
 * @typeParam TEvent  The event type this process manager handles.
 */
export abstract class ProcessManager<TState, TEvent = unknown> {
  /** Human-readable name used in process state records. */
  protected abstract readonly name: string;

  /** State machine that governs which transitions are permitted. */
  protected abstract readonly machine: StateMachine<TState>;

  /** Initial domain state assigned to every newly created process. */
  protected abstract initialState(): TState;

  /**
   * Handle an inbound event.
   * Concrete subclasses load (or create) their process state, apply
   * business logic and call the protected mutation helpers.
   */
  abstract handle(event: TEvent): Promise<void>;

  // ── Protected helpers ───────────────────────────────────────────────────────

  /**
   * Create a fresh process state in `running` status.
   * @param id             Unique process identifier (defaults to a UUID).
   * @param correlationId  Optional business correlation key.
   */
  protected begin(id?: string, correlationId?: string): ProcessState<TState> {
    const now = new Date();
    const state: ProcessState<TState> = {
      id: id ?? crypto.randomUUID(),
      name: this.name,
      status: 'running' as ProcessStatus,
      currentState: this.initialState(),
      startedAt: now,
      updatedAt: now,
    };
    if (correlationId !== undefined) {
      state.correlationId = correlationId;
    }
    return state;
  }

  /**
   * Apply a validated state-machine transition.
   * Throws `InvalidTransitionError` if the transition is not permitted.
   */
  protected transition(state: ProcessState<TState>, to: TState): void {
    this.machine.validateTransition(state.currentState, to);
    state.currentState = to;
    state.updatedAt = new Date();
  }

  /**
   * Mark the process as successfully completed.
   * Does not validate against the state machine — any state may complete.
   */
  protected complete(state: ProcessState<TState>): void {
    state.status = 'completed';
    state.updatedAt = new Date();
  }

  /**
   * Mark the process as failed and record the error.
   */
  protected fail(state: ProcessState<TState>, error: unknown): void {
    state.status = 'failed';
    state.error = error;
    state.updatedAt = new Date();
  }

  /**
   * Mark the process as timed out.
   */
  protected timeOut(state: ProcessState<TState>): void {
    state.status = 'timed-out';
    state.updatedAt = new Date();
  }

  /**
   * Set (or change) the optional deadline for a process.
   */
  protected setTimeoutAt(state: ProcessState<TState>, at: Date): void {
    state.timeoutAt = at;
    state.updatedAt = new Date();
  }
}
