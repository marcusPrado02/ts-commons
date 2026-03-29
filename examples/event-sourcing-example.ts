/**
 * Event Sourcing example: EventSourcedAggregate + EventStore + Projection
 *
 * Demonstrates:
 *  - @acme/eventsourcing — EventSourcedAggregate, InMemoryEventStore, ProjectionRunner
 *  - @acme/kernel        — DomainEvent (abstract class)
 *
 * Pattern:
 *  1. Domain events are the source of truth (append-only log)
 *  2. Aggregate state is rebuilt by replaying events (loadFromHistory)
 *  3. Projections build read-model views from the same event stream
 *  4. The event store detects concurrent write conflicts (optimistic locking)
 *
 * Run (after pnpm build):
 *   npx tsx --tsconfig examples/tsconfig.json examples/event-sourcing-example.ts
 */

import { DomainEvent } from '@acme/kernel';
import {
  EventSourcedAggregate,
  InMemoryEventStore,
  ProjectionRunner,
  ConcurrencyError,
} from '@acme/eventsourcing';
import type { Projection } from '@acme/eventsourcing';

// ─── Domain events ────────────────────────────────────────────────────────────
// DomainEvent is an abstract class — extend it (do not implement as interface).
// The base constructor auto-generates eventId (UUID) and eventType (class name).

class AccountOpened extends DomainEvent {
  constructor(
    readonly accountId: string,
    readonly owner: string,
    readonly initialBalance: number,
  ) {
    super();
  }
}

class MoneyDeposited extends DomainEvent {
  constructor(
    readonly accountId: string,
    readonly amount: number,
  ) {
    super();
  }
}

class MoneyWithdrawn extends DomainEvent {
  constructor(
    readonly accountId: string,
    readonly amount: number,
  ) {
    super();
  }
}

class AccountFrozen extends DomainEvent {
  constructor(readonly accountId: string) {
    super();
  }
}

// ─── Aggregate ────────────────────────────────────────────────────────────────

class BankAccount extends EventSourcedAggregate<string> {
  private _owner = '';
  private _balance = 0;
  private _frozen = false;

  private constructor(id: string) {
    super(id);
  }

  // ── Factory ──────────────────────────────────────────────────────────────

  static open(accountId: string, owner: string, initialBalance: number): BankAccount {
    if (initialBalance < 0) throw new Error('Initial balance must be non-negative');
    const account = new BankAccount(accountId);
    account.raise(new AccountOpened(accountId, owner, initialBalance));
    return account;
  }

  static loadFromStore(accountId: string, events: DomainEvent[]): BankAccount {
    const account = new BankAccount(accountId);
    account.loadFromHistory(events);
    return account;
  }

  // ── Commands ─────────────────────────────────────────────────────────────

  deposit(amount: number): void {
    if (this._frozen) throw new Error('Account is frozen');
    if (amount <= 0) throw new Error('Deposit amount must be positive');
    this.raise(new MoneyDeposited(this.id, amount));
  }

  withdraw(amount: number): void {
    if (this._frozen) throw new Error('Account is frozen');
    if (amount > this._balance) throw new Error('Insufficient funds');
    this.raise(new MoneyWithdrawn(this.id, amount));
  }

  freeze(): void {
    this.raise(new AccountFrozen(this.id));
  }

  // ── State projection (apply) ──────────────────────────────────────────────

  protected apply(event: DomainEvent): void {
    if (event instanceof AccountOpened) {
      this._owner = event.owner;
      this._balance = event.initialBalance;
    } else if (event instanceof MoneyDeposited) {
      this._balance += event.amount;
    } else if (event instanceof MoneyWithdrawn) {
      this._balance -= event.amount;
    } else if (event instanceof AccountFrozen) {
      this._frozen = true;
    }
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  get owner(): string {
    return this._owner;
  }
  get balance(): number {
    return this._balance;
  }
  get isFrozen(): boolean {
    return this._frozen;
  }
}

// ─── Read-model projection ────────────────────────────────────────────────────

interface AccountSummary {
  accountId: string;
  owner: string;
  balance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  frozen: boolean;
  txCount: number;
}

class AccountSummaryProjection implements Projection<AccountSummary> {
  state: AccountSummary = {
    accountId: '',
    owner: '',
    balance: 0,
    totalDeposited: 0,
    totalWithdrawn: 0,
    frozen: false,
    txCount: 0,
  };

  apply(event: DomainEvent): void {
    if (event instanceof AccountOpened) {
      this.state.accountId = event.accountId;
      this.state.owner = event.owner;
      this.state.balance = event.initialBalance;
    } else if (event instanceof MoneyDeposited) {
      this.state.balance += event.amount;
      this.state.totalDeposited += event.amount;
      this.state.txCount++;
    } else if (event instanceof MoneyWithdrawn) {
      this.state.balance -= event.amount;
      this.state.totalWithdrawn += event.amount;
      this.state.txCount++;
    } else if (event instanceof AccountFrozen) {
      this.state.frozen = true;
    }
  }
}

// ─── Bootstrap & Run ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const store = new InMemoryEventStore();
  const accountId = 'acc-001';

  // ── Open account and perform transactions ──────────────────────────────────
  console.log('\n── Opening account and executing transactions ──────────────');
  const account = BankAccount.open(accountId, 'Alice', 1000);
  account.deposit(500);
  account.withdraw(200);
  account.deposit(1500);

  // Persist events at version 0 (new stream)
  const uncommitted = [...account.getUncommittedEvents()];
  await store.append(accountId, uncommitted, 0);
  account.markCommitted();

  console.log(`Account ${accountId} opened for ${account.owner}`);
  console.log(`  Balance after transactions: ${account.balance}`);
  console.log(`  Version: ${account.version}`);

  // ── Replay from store (simulates service restart) ─────────────────────────
  console.log('\n── Reloading from event store ──────────────────────────────');
  const history = await store.getEvents(accountId);
  const reloaded = BankAccount.loadFromStore(accountId, history);

  console.log(`  Reloaded balance: ${reloaded.balance}`);
  console.log(`  Reloaded version: ${reloaded.version}`);
  console.log(`  Events in store:  ${history.length}`);

  // ── Projection: build read model from same events ─────────────────────────
  console.log('\n── Building read-model projection ──────────────────────────');
  const runner = new ProjectionRunner(new AccountSummaryProjection());
  const summary = runner.run(history);

  console.log('  Summary:', {
    owner: summary.owner,
    balance: summary.balance,
    totalDeposited: summary.totalDeposited,
    totalWithdrawn: summary.totalWithdrawn,
    txCount: summary.txCount,
    frozen: summary.frozen,
  });

  // ── Optimistic concurrency conflict ───────────────────────────────────────
  console.log('\n── Demonstrating optimistic concurrency conflict ───────────');
  const accountA = BankAccount.loadFromStore(accountId, history);
  const accountB = BankAccount.loadFromStore(accountId, history);

  accountA.deposit(100);
  accountB.withdraw(50); // concurrent modification of the same aggregate

  // First writer wins
  await store.append(accountId, [...accountA.getUncommittedEvents()], history.length);
  console.log('  First writer (deposit 100): succeeded');

  try {
    // Second writer should fail — the stream has already moved forward
    await store.append(accountId, [...accountB.getUncommittedEvents()], history.length);
    console.log('  Second writer (withdraw 50): succeeded (unexpected)');
  } catch (err) {
    if (err instanceof ConcurrencyError) {
      console.log(`  Second writer (withdraw 50): blocked — ${err.message}`);
    }
  }
}

main().catch(console.error);
