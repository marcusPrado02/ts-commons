import type { TransitionRule } from './types.js';

/**
 * Thrown when a state transition is not permitted by the registered rules.
 */
export class InvalidTransitionError extends Error {
  constructor(from: unknown, to: unknown) {
    super(`Invalid transition from '${String(from)}' to '${String(to)}'`);
    this.name = 'InvalidTransitionError';
  }
}

/**
 * Finite state machine that validates transitions against a fixed set of rules.
 */
export class StateMachine<TState> {
  private readonly rules: ReadonlyArray<TransitionRule<TState>>;

  constructor(rules: TransitionRule<TState>[]) {
    this.rules = rules;
  }

  canTransition(from: TState, to: TState): boolean {
    return this.rules.some((r) => r.from === from && r.to === to);
  }

  validateTransition(from: TState, to: TState): void {
    if (!this.canTransition(from, to)) {
      throw new InvalidTransitionError(from, to);
    }
  }

  getAllowedTransitions(from: TState): TState[] {
    return this.rules.filter((r) => r.from === from).map((r) => r.to);
  }

  getRuleCount(): number {
    return this.rules.length;
  }
}
