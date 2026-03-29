/**
 * End-to-end DDD example: ValueObject → AggregateRoot → Mediator → Repository
 *
 * Demonstrates:
 *  - @marcusprado02/kernel      — AggregateRoot<TId>, DomainEvent (abstract class), Result
 *  - @marcusprado02/application — MediatorRequest, Mediator, RequestHandler
 *  - @marcusprado02/persistence — RepositoryPort<T, TId>, Page
 *
 * Run (after pnpm build):
 *   npx tsx --tsconfig examples/tsconfig.json examples/order-example.ts
 */

import { randomUUID } from 'node:crypto';

import { AggregateRoot, DomainEvent, Result } from '@marcusprado02/kernel';
import { MediatorRequest, Mediator } from '@marcusprado02/application';
import type { RequestHandler } from '@marcusprado02/application';
import type { RepositoryPort } from '@marcusprado02/persistence';

// ─── Value Object ─────────────────────────────────────────────────────────────

class Money {
  private constructor(
    readonly amount: number,
    readonly currency: string,
  ) {}

  static of(amount: number, currency = 'USD'): Result<Money, string> {
    if (amount < 0) return Result.err('Amount must be non-negative');
    return Result.ok(new Money(amount, currency));
  }

  add(other: Money): Result<Money, string> {
    if (this.currency !== other.currency) return Result.err('Currency mismatch');
    return Money.of(this.amount + other.amount, this.currency);
  }

  toString(): string {
    return `${this.currency} ${this.amount.toFixed(2)}`;
  }
}

// ─── Domain Events ────────────────────────────────────────────────────────────
// DomainEvent is an abstract class — events must extend it, not implement it.
// The base class auto-populates eventId (UUID) and eventType (class name).

class OrderCreated extends DomainEvent {
  constructor(readonly orderId: string) {
    super();
  }
}

class OrderConfirmed extends DomainEvent {
  constructor(
    readonly orderId: string,
    readonly total: Money,
  ) {
    super();
  }
}

// ─── Aggregate ────────────────────────────────────────────────────────────────

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

class Order extends AggregateRoot<string> {
  private _status: OrderStatus = 'PENDING';
  private _items: Array<{ sku: string; qty: number; price: Money }> = [];

  private constructor(id: string) {
    super(id);
  }

  static create(): Order {
    const order = new Order(randomUUID());
    order.record(new OrderCreated(order.id)); // record() is protected — called from within
    return order;
  }

  get status(): OrderStatus {
    return this._status;
  }

  addItem(sku: string, qty: number, price: Money): Result<void, string> {
    if (this._status !== 'PENDING') return Result.err('Cannot modify a confirmed order');
    if (qty <= 0) return Result.err('Quantity must be positive');
    this._items.push({ sku, qty, price });
    return Result.ok(undefined);
  }

  confirm(): Result<void, string> {
    if (this._items.length === 0) return Result.err('Cannot confirm an empty order');
    if (this._status !== 'PENDING') return Result.err('Order is already confirmed');

    let runningResult = Money.of(0);
    for (const item of this._items) {
      const lineResult = Money.of(item.price.amount * item.qty, item.price.currency);
      if (lineResult.isErr()) return Result.err(lineResult.unwrapErr());
      const sumResult = runningResult.unwrap().add(lineResult.unwrap());
      if (sumResult.isErr()) return Result.err(sumResult.unwrapErr());
      runningResult = sumResult;
    }

    this._status = 'CONFIRMED';
    this.record(new OrderConfirmed(this.id, runningResult.unwrap()));
    return Result.ok(undefined);
  }
}

// ─── Infrastructure (in-memory) ───────────────────────────────────────────────

class InMemoryOrderRepository implements RepositoryPort<Order, string> {
  private readonly store = new Map<string, Order>();

  async findById(id: string): Promise<Order | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(): Promise<Order[]> {
    return [...this.store.values()];
  }

  async exists(id: string): Promise<boolean> {
    return this.store.has(id);
  }

  async save(entity: Order): Promise<void> {
    this.store.set(entity.id, entity);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

// ─── Application Layer ────────────────────────────────────────────────────────

class ConfirmOrderCommand extends MediatorRequest<{ orderId: string; total: string }> {
  constructor(readonly items: Array<{ sku: string; qty: number; priceAmount: number }>) {
    super();
  }
}

class ConfirmOrderHandler implements RequestHandler<
  ConfirmOrderCommand,
  { orderId: string; total: string }
> {
  constructor(private readonly orders: RepositoryPort<Order, string>) {}

  async handle(cmd: ConfirmOrderCommand): Promise<{ orderId: string; total: string }> {
    const order = Order.create();

    for (const item of cmd.items) {
      const priceResult = Money.of(item.priceAmount);
      if (priceResult.isErr()) throw new Error(priceResult.unwrapErr());
      const addResult = order.addItem(item.sku, item.qty, priceResult.unwrap());
      if (addResult.isErr()) throw new Error(addResult.unwrapErr());
    }

    const confirmResult = order.confirm();
    if (confirmResult.isErr()) throw new Error(confirmResult.unwrapErr());

    await this.orders.save(order);

    // Capture events before clearing them
    const events = order.getUncommittedEvents();
    const confirmed = events.find((e): e is OrderConfirmed => e instanceof OrderConfirmed);
    order.clearEvents();

    console.log(`  Events: ${events.map((e) => e.eventType).join(', ')}`);
    return { orderId: order.id, total: confirmed?.total.toString() ?? '0.00' };
  }
}

// ─── Bootstrap & Run ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const orders = new InMemoryOrderRepository();
  const mediator = new Mediator();
  mediator.register(ConfirmOrderCommand, new ConfirmOrderHandler(orders));

  console.log('\n── Confirming order ────────────────────────────────────────');
  const result = await mediator.send(
    new ConfirmOrderCommand([
      { sku: 'SKU-001', qty: 2, priceAmount: 49.9 },
      { sku: 'SKU-002', qty: 1, priceAmount: 129.0 },
    ]),
  );
  console.log(`  Order ID : ${result.orderId}`);
  console.log(`  Total    : ${result.total}`);

  const saved = await orders.findById(result.orderId);
  console.log(`  Saved status: ${saved?.status ?? 'not found'}`);

  console.log('\n── Empty order (error case) ────────────────────────────────');
  try {
    await mediator.send(new ConfirmOrderCommand([]));
  } catch (err) {
    console.log(`  Error caught: ${(err as Error).message}`);
  }
}

main().catch(console.error);
