import type { DomainEvent } from '@acme/kernel';

/**
 * A read-model projection that builds a `TState` view from domain events.
 *
 * @template TState  The type of the read-model produced by this projection.
 *
 * @example
 * ```ts
 * class AccountBalanceProjection implements Projection<{ balance: number }> {
 *   state = { balance: 0 };
 *
 *   apply(event: DomainEvent): void {
 *     if (event instanceof MoneyDeposited)  this.state.balance += event.amount;
 *     if (event instanceof MoneyWithdrawn)  this.state.balance -= event.amount;
 *   }
 * }
 * ```
 */
export interface Projection<TState> {
  /** The current accumulated state of this projection. */
  state: TState;
  /**
   * Mutates {@link state} in response to a domain event.
   * Unknown event types may be silently ignored.
   */
  apply(event: DomainEvent): void;
}

/**
 * Drives a {@link Projection} over an ordered stream of events,
 * returning the final state.
 *
 * @template TState  The read-model type produced by the wrapped projection.
 *
 * @example
 * ```ts
 * const runner = new ProjectionRunner(new AccountBalanceProjection());
 * const { balance } = runner.run(events);
 * ```
 */
export class ProjectionRunner<TState> {
  constructor(private readonly projection: Projection<TState>) {}

  /**
   * Applies each event in order to the projection and returns the final state.
   */
  run(events: DomainEvent[]): TState {
    for (const event of events) {
      this.projection.apply(event);
    }
    return this.projection.state;
  }

  /** Returns the current state without processing additional events. */
  get currentState(): TState {
    return this.projection.state;
  }
}
