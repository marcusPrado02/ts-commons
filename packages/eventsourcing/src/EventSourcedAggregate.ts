/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import type { DomainEvent } from '@acme/kernel';

/**
 * Base class for event-sourced aggregates.
 *
 * State is rebuilt by replaying past events ({@link loadFromHistory}).
 * New state changes are recorded via {@link raise}, which both applies the
 * event immediately and queues it as an uncommitted event.
 *
 * @template TId  The type of the aggregate identifier.
 *
 * @example
 * ```ts
 * class BankAccount extends EventSourcedAggregate<AccountId> {
 *   private _balance = 0;
 *
 *   static create(id: AccountId, initialBalance: number): BankAccount {
 *     const account = new BankAccount(id);
 *     account.raise(new AccountOpened(id, initialBalance));
 *     return account;
 *   }
 *
 *   deposit(amount: number): void {
 *     this.raise(new MoneyDeposited(amount));
 *   }
 *
 *   protected apply(event: DomainEvent): void {
 *     if (event instanceof AccountOpened)  this._balance = event.initialBalance;
 *     if (event instanceof MoneyDeposited) this._balance += event.amount;
 *   }
 * }
 * ```
 */
export abstract class EventSourcedAggregate<TId> {
  private _version = 0;
  private readonly _uncommittedEvents: DomainEvent[] = [];

  protected constructor(protected readonly _id: TId) {}

  /** The current version (count of all applied events, including history). */
  get version(): number {
    return this._version;
  }

  /** The aggregate identifier. */
  get id(): TId {
    return this._id;
  }

  /**
   * Returns events raised since the last {@link markCommitted} call.
   * These events must be persisted to the event store.
   */
  getUncommittedEvents(): readonly DomainEvent[] {
    return [...this._uncommittedEvents];
  }

  /**
   * Clears the uncommitted events list after they have been persisted.
   */
  markCommitted(): void {
    this._uncommittedEvents.length = 0;
  }

  /**
   * Rebuilds aggregate state from a historical event stream.
   * Call this when loading an aggregate from the event store.
   */
  loadFromHistory(events: DomainEvent[]): void {
    for (const event of events) {
      this.apply(event);
      this._version++;
    }
  }

  /**
   * Records a new domain event: applies it to state, increments version,
   * and queues it as uncommitted.
   */
  protected raise(event: DomainEvent): void {
    this.apply(event);
    this._version++;
    this._uncommittedEvents.push(event);
  }

  /**
   * Mutates aggregate state in response to a domain event.
   * Implementations must be pure and free of side effects.
   */
  protected abstract apply(event: DomainEvent): void;
}
