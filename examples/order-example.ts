/**
 * End-to-end example: DDD → UseCase → Repository → Event Publishing
 *
 * Demonstrates:
 *  - @acme/kernel  — Entity, ValueObject, AggregateRoot, DomainEvent, Result
 *  - @acme/application — MediatorRequest, Mediator
 *  - @acme/persistence — RepositoryPort, Page
 *  - @acme/messaging  — EventPublisherPort
 *  - @acme/errors     — ProblemDetails
 *
 * Run (after build):
 *   npx tsx examples/order-example.ts
 */

// ─── Domain ──────────────────────────────────────────────────────────────────

import type { DomainEvent } from '@acme/kernel';
import { AggregateRoot, Result } from '@acme/kernel';

/** Value object: non-negative monetary amount */
class Money {
  private constructor(
    readonly amount: number,
    readonly currency: string,
  ) {}

  static of(amount: number, currency = 'BRL'): Result<Money, string> {
    if (amount < 0) return Result.fail('Amount must be non-negative');
    return Result.ok(new Money(amount, currency));
  }

  add(other: Money): Result<Money, string> {
    if (this.currency !== other.currency) return Result.fail('Currency mismatch');
    return Money.of(this.amount + other.amount, this.currency);
  }

  toString(): string {
    return `${this.currency} ${this.amount.toFixed(2)}`;
  }
}

/** Domain event emitted when an order is confirmed */
class OrderConfirmed implements DomainEvent {
  readonly occurredAt = new Date();
  constructor(
    readonly orderId: string,
    readonly total: Money,
  ) {}
}

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

/** Aggregate: encapsulates order business rules */
class Order extends AggregateRoot {
  private _status: OrderStatus = 'PENDING';
  private _items: Array<{ sku: string; qty: number; price: Money }> = [];

  get status(): OrderStatus {
    return this._status;
  }

  addItem(sku: string, qty: number, price: Money): Result<void, string> {
    if (this._status !== 'PENDING') return Result.fail('Cannot modify a confirmed order');
    if (qty <= 0) return Result.fail('Quantity must be positive');
    this._items.push({ sku, qty, price });
    return Result.ok(undefined);
  }

  confirm(): Result<void, string> {
    if (this._items.length === 0) return Result.fail('Cannot confirm an empty order');
    if (this._status !== 'PENDING') return Result.fail('Order is already confirmed');

    const totalResult = this._items.reduce<Result<Money, string>>((acc, item) => {
      if (!acc.isOk()) return acc;
      const lineResult = Money.of(item.price.amount * item.qty, item.price.currency);
      if (!lineResult.isOk()) return lineResult;
      return acc.value.add(lineResult.value);
    }, Money.of(0));

    if (!totalResult.isOk()) return Result.fail(totalResult.error);

    this._status = 'CONFIRMED';
    this.addDomainEvent(new OrderConfirmed(this.id, totalResult.value));
    return Result.ok(undefined);
  }
}

// ─── Application ─────────────────────────────────────────────────────────────

import { MediatorRequest, Mediator } from '@acme/application';
import type { RequestHandler } from '@acme/application';

/** Command: create and confirm an order */
class ConfirmOrderCommand extends MediatorRequest<{ orderId: string; total: string }> {
  constructor(
    readonly customerId: string,
    readonly items: Array<{ sku: string; qty: number; priceAmount: number }>,
  ) {
    super();
  }
}

// ─── Infrastructure (in-memory stubs) ────────────────────────────────────────

import type { RepositoryPort } from '@acme/persistence';
import type { EventPublisherPort, EventEnvelope } from '@acme/messaging';

/** In-memory order repository */
class InMemoryOrderRepository implements RepositoryPort<Order> {
  private readonly store = new Map<string, Order>();

  async findById(id: string): Promise<Order | null> {
    return this.store.get(id) ?? null;
  }

  async save(entity: Order): Promise<void> {
    this.store.set(entity.id, entity);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async findAll(_options?: unknown): Promise<import('@acme/persistence').Page<Order>> {
    const items = [...this.store.values()];
    return { items, total: items.length, page: 1, pageSize: items.length };
  }
}

/** Console event publisher (prints events to stdout) */
class ConsoleEventPublisher implements EventPublisherPort {
  async publish(envelope: EventEnvelope): Promise<void> {
    console.log(`[EVENT] ${envelope.type}`, JSON.stringify(envelope.payload, null, 2));
  }
}

// ─── Use Case Handler ─────────────────────────────────────────────────────────

class ConfirmOrderHandler implements RequestHandler<
  ConfirmOrderCommand,
  { orderId: string; total: string }
> {
  constructor(
    private readonly orders: InMemoryOrderRepository,
    private readonly events: EventPublisherPort,
  ) {}

  async handle(cmd: ConfirmOrderCommand): Promise<{ orderId: string; total: string }> {
    const order = new Order();

    for (const item of cmd.items) {
      const priceResult = Money.of(item.priceAmount);
      if (!priceResult.isOk()) throw new Error(priceResult.error);

      const addResult = order.addItem(item.sku, item.qty, priceResult.value);
      if (!addResult.isOk()) throw new Error(addResult.error);
    }

    const confirmResult = order.confirm();
    if (!confirmResult.isOk()) throw new Error(confirmResult.error);

    await this.orders.save(order);

    // Publish domain events
    for (const event of order.getUncommittedEvents()) {
      await this.events.publish({
        type: event.constructor.name,
        payload: event,
        occurredAt: (event as DomainEvent).occurredAt,
        aggregateId: order.id,
      });
    }
    order.clearUncommittedEvents();

    const confirmedEvent = order.getUncommittedEvents()[0];
    const total = confirmedEvent instanceof OrderConfirmed ? confirmedEvent.total.toString() : '—';

    return { orderId: order.id, total };
  }
}

// ─── Bootstrap & Run ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const orders = new InMemoryOrderRepository();
  const eventPublisher = new ConsoleEventPublisher();

  const mediator = new Mediator();
  mediator.register(ConfirmOrderCommand, new ConfirmOrderHandler(orders, eventPublisher));

  const result = await mediator.send(
    new ConfirmOrderCommand('customer-42', [
      { sku: 'SKU-001', qty: 2, priceAmount: 49.9 },
      { sku: 'SKU-002', qty: 1, priceAmount: 129.0 },
    ]),
  );

  console.log(`\nOrder confirmed!`);
  console.log(`  Order ID : ${result.orderId}`);
  console.log(`  Total    : ${result.total}`);
}

main().catch(console.error);
