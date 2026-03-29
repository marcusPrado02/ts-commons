/**
 * Microservice example: HTTP handler + CQRS + Metrics + Logging + Error mapping
 *
 * Demonstrates:
 *  - @acme/application  — Mediator, MediatorRequest, RequestHandler
 *  - @acme/persistence  — RepositoryPort<T, TId>
 *  - @acme/observability — Logger, InMemoryMetrics
 *  - @acme/errors       — HttpErrorMapper, AppError
 *  - @acme/kernel       — AggregateRoot<TId>, DomainEvent (abstract class), Result
 *
 * Run (after pnpm build):
 *   npx tsx --tsconfig examples/tsconfig.json examples/microservice-example.ts
 */

import { randomUUID } from 'node:crypto';

import { AggregateRoot, DomainEvent, Result } from '@acme/kernel';
import { MediatorRequest, Mediator } from '@acme/application';
import type { RequestHandler } from '@acme/application';
import type { RepositoryPort } from '@acme/persistence';
import { Logger, InMemoryMetrics } from '@acme/observability';
import { AppError, AppErrorCode, HttpErrorMapper } from '@acme/errors';

// ─── Domain ──────────────────────────────────────────────────────────────────

// DomainEvent is an abstract class — extend it (do not implement as interface)
class ProductCreated extends DomainEvent {
  constructor(
    readonly productId: string,
    readonly name: string,
  ) {
    super();
  }
}

class Product extends AggregateRoot<string> {
  private _name: string;
  private _stock: number;

  private constructor(id: string, name: string, stock: number) {
    super(id);
    this._name = name;
    this._stock = stock;
  }

  static create(name: string, stock: number): Result<Product, string> {
    if (!name.trim()) return Result.err('Name is required');
    if (stock < 0) return Result.err('Stock cannot be negative');
    const product = new Product(randomUUID(), name, stock);
    product.record(new ProductCreated(product.id, name));
    return Result.ok(product);
  }

  get name(): string {
    return this._name;
  }
  get stock(): number {
    return this._stock;
  }

  destock(qty: number): Result<void, string> {
    if (qty > this._stock) return Result.err('Insufficient stock');
    this._stock -= qty;
    return Result.ok(undefined);
  }
}

// ─── Application layer ────────────────────────────────────────────────────────

class CreateProductCommand extends MediatorRequest<{ id: string; name: string }> {
  constructor(
    readonly name: string,
    readonly initialStock: number,
  ) {
    super();
  }
}

class GetProductQuery extends MediatorRequest<Product | null> {
  constructor(readonly productId: string) {
    super();
  }
}

// ─── Infrastructure (in-memory) ───────────────────────────────────────────────

class InMemoryProductRepository implements RepositoryPort<Product, string> {
  private readonly store = new Map<string, Product>();

  async findById(id: string): Promise<Product | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(): Promise<Product[]> {
    return [...this.store.values()];
  }

  async exists(id: string): Promise<boolean> {
    return this.store.has(id);
  }

  async save(entity: Product): Promise<void> {
    this.store.set(entity.id, entity);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

class CreateProductHandler implements RequestHandler<
  CreateProductCommand,
  { id: string; name: string }
> {
  constructor(
    private readonly products: RepositoryPort<Product, string>,
    private readonly logger: Logger,
    private readonly metrics: InMemoryMetrics,
  ) {}

  async handle(cmd: CreateProductCommand): Promise<{ id: string; name: string }> {
    const result = Product.create(cmd.name, cmd.initialStock);
    if (!result.isOk()) {
      throw new AppError(result.unwrapErr(), AppErrorCode.VALIDATION_ERROR);
    }
    const product = result.unwrap();
    await this.products.save(product);
    this.metrics.incrementCounter('products.created');
    this.logger.info('Product created', { productId: product.id, name: product.name });
    return { id: product.id, name: product.name };
  }
}

class GetProductHandler implements RequestHandler<GetProductQuery, Product | null> {
  constructor(
    private readonly products: RepositoryPort<Product, string>,
    private readonly metrics: InMemoryMetrics,
  ) {}

  async handle(query: GetProductQuery): Promise<Product | null> {
    this.metrics.incrementCounter('products.queried');
    return this.products.findById(query.productId);
  }
}

// ─── Bootstrap & Run ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const logger = new Logger({ name: 'microservice-example' });
  const metrics = new InMemoryMetrics();
  const products = new InMemoryProductRepository();

  const mediator = new Mediator();
  mediator.register(CreateProductCommand, new CreateProductHandler(products, logger, metrics));
  mediator.register(GetProductQuery, new GetProductHandler(products, metrics));

  // ── Simulate HTTP POST /products ──────────────────────────────────────────
  console.log('\n── POST /products ──────────────────────────────────────────');
  let created: { id: string; name: string };
  try {
    created = await mediator.send(new CreateProductCommand('TypeScript T-Shirt', 100));
    console.log('201 Created:', created);
  } catch (err) {
    const problem = HttpErrorMapper.toProblemDetails(
      err instanceof Error ? err : new Error(String(err)),
    );
    console.error('Error:', problem);
    return;
  }

  // ── Simulate HTTP GET /products/:id ───────────────────────────────────────
  console.log('\n── GET /products/:id ───────────────────────────────────────');
  const found = await mediator.send(new GetProductQuery(created.id));
  if (found) {
    console.log('200 OK:', { id: found.id, name: found.name, stock: found.stock });
  } else {
    console.log('404 Not Found');
  }

  // ── Simulate validation error ─────────────────────────────────────────────
  console.log('\n── POST /products (invalid) ────────────────────────────────');
  try {
    await mediator.send(new CreateProductCommand('', -5));
  } catch (err) {
    const problem = HttpErrorMapper.toProblemDetails(
      err instanceof Error ? err : new Error(String(err)),
    );
    console.log('422 Unprocessable Entity:', problem);
  }

  // ── Observability summary ─────────────────────────────────────────────────
  console.log('\n── Metrics snapshot ────────────────────────────────────────');
  const snapshot = metrics.getSnapshot();
  for (const counter of snapshot.counters) {
    console.log(`  ${counter.name}: ${counter.value}`);
  }
}

main().catch(console.error);
