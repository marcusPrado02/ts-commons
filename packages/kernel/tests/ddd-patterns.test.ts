import { describe, it, expect } from 'vitest';
import { Result } from '../src/primitives/Result';
import { Entity } from '../src/ddd/Entity';
import { Specification } from '../src/ddd/Specification';
import { Factory } from '../src/ddd/Factory';
import { AbstractRepository } from '../src/ddd/Repository';
import type { DomainService } from '../src/ddd/DomainService';
import { Policy } from '../src/ddd/Policy';
import { DomainError } from '../src/errors/DomainError';
import { InvariantViolationError } from '../src/errors/InvariantViolationError';

// ---------------------------------------------------------------------------
// Shared domain fixtures
// ---------------------------------------------------------------------------

class ProductId {
  constructor(readonly value: string) {}
}

class Product extends Entity<ProductId> {
  constructor(
    id: ProductId,
    readonly name: string,
    readonly price: number,
  ) {
    super(id);
  }
}

class InvalidPriceError extends DomainError {
  constructor(price: number) {
    super(`Price must be positive, got ${price}`, 'invalid_price');
  }
}

class InvalidNameError extends DomainError {
  constructor() {
    super('Name must not be empty', 'invalid_name');
  }
}

// ---------------------------------------------------------------------------
// Suite 1: Factory
// ---------------------------------------------------------------------------

interface ProductProps {
  id: string;
  name: string;
  price: number;
}

class ProductFactory extends Factory<Product, ProductProps> {
  create(props: ProductProps): Result<Product, DomainError> {
    if (props.name.trim().length === 0) {
      return Result.err(new InvalidNameError());
    }
    if (props.price <= 0) {
      return Result.err(new InvalidPriceError(props.price));
    }
    return Result.ok(new Product(new ProductId(props.id), props.name, props.price));
  }
}

describe('Factory', () => {
  const factory = new ProductFactory();

  it('returns Ok with the created entity when props are valid', () => {
    const result = factory.create({ id: 'p-1', name: 'Widget', price: 9.99 });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().name).toBe('Widget');
    expect(result.unwrap().price).toBe(9.99);
  });

  it('returns Err with DomainError when price is invalid', () => {
    const result = factory.create({ id: 'p-2', name: 'Widget', price: -5 });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(DomainError);
    expect(result.unwrapErr().message).toContain('positive');
  });

  it('returns Err with DomainError when name is empty', () => {
    const result = factory.create({ id: 'p-3', name: '  ', price: 10 });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('empty');
  });

  it('factory result can be mapped over on success path', () => {
    const result = factory.create({ id: 'p-4', name: 'Gadget', price: 20 });
    const mapped = result.map((p) => p.price * 2);
    expect(mapped.unwrap()).toBe(40);
  });

  it('multiple factory calls are independent', () => {
    const r1 = factory.create({ id: 'p-5', name: 'A', price: 1 });
    const r2 = factory.create({ id: 'p-6', name: 'B', price: 2 });
    expect(r1.unwrap().id.value).toBe('p-5');
    expect(r2.unwrap().id.value).toBe('p-6');
  });
});

// ---------------------------------------------------------------------------
// Suite 2: AbstractRepository
// ---------------------------------------------------------------------------

class ActiveProductSpec extends Specification<Product> {
  constructor(private readonly minPrice: number) {
    super();
  }
  isSatisfiedBy(product: Product): boolean {
    return product.price >= this.minPrice;
  }
}

class InMemoryProductRepository extends AbstractRepository<Product, ProductId> {
  private readonly store = new Map<string, Product>();

  findById(id: ProductId): Promise<Product | undefined> {
    return Promise.resolve(this.store.get(id.value));
  }

  findBy(spec: Specification<Product>): Promise<Product[]> {
    return Promise.resolve([...this.store.values()].filter((p) => spec.isSatisfiedBy(p)));
  }

  save(product: Product): Promise<void> {
    this.store.set(product.id.value, product);
    return Promise.resolve();
  }

  delete(id: ProductId): Promise<void> {
    this.store.delete(id.value);
    return Promise.resolve();
  }
}

describe('AbstractRepository', () => {
  it('findById returns the entity when it exists', async () => {
    const repo = new InMemoryProductRepository();
    const product = new Product(new ProductId('p-1'), 'Widget', 10);
    await repo.save(product);
    const found = await repo.findById(new ProductId('p-1'));
    expect(found).toBe(product);
  });

  it('findById returns undefined for unknown id', async () => {
    const repo = new InMemoryProductRepository();
    const found = await repo.findById(new ProductId('unknown'));
    expect(found).toBeUndefined();
  });

  it('findBy returns entities matching the specification', async () => {
    const repo = new InMemoryProductRepository();
    await repo.save(new Product(new ProductId('cheap'), 'Cheap', 5));
    await repo.save(new Product(new ProductId('mid'), 'Mid', 15));
    await repo.save(new Product(new ProductId('expensive'), 'Expensive', 50));
    const results = await repo.findBy(new ActiveProductSpec(10));
    expect(results).toHaveLength(2);
    expect(results.map((p) => p.id.value).sort((a, b) => a.localeCompare(b))).toEqual(['expensive', 'mid']);
  });

  it('findBy returns empty array when no entity matches', async () => {
    const repo = new InMemoryProductRepository();
    await repo.save(new Product(new ProductId('p-1'), 'Widget', 5));
    const results = await repo.findBy(new ActiveProductSpec(100));
    expect(results).toHaveLength(0);
  });

  it('exists() returns true/false via findBy', async () => {
    const repo = new InMemoryProductRepository();
    await repo.save(new Product(new ProductId('p-1'), 'Widget', 25));
    expect(await repo.exists(new ActiveProductSpec(10))).toBe(true);
    expect(await repo.exists(new ActiveProductSpec(100))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: DomainService
// ---------------------------------------------------------------------------

class PricingService implements DomainService {
  readonly serviceName = 'PricingService';

  applyDiscount(product: Product, pct: number): Result<number, DomainError> {
    if (pct < 0 || pct > 100) {
      return Result.err(new InvariantViolationError(`Invalid discount: ${pct}`, 'invalid_discount'));
    }
    return Result.ok(product.price * (1 - pct / 100));
  }

  bulkPrice(products: Product[], discount: number): Result<number, DomainError> {
    const total = products.reduce((sum, p) => sum + p.price, 0);
    return Result.ok(total * (1 - discount / 100));
  }
}

describe('DomainService', () => {
  const service = new PricingService();

  it('implements DomainService with a serviceName', () => {
    expect(service.serviceName).toBe('PricingService');
  });

  it('service operation returns Ok with computed value', () => {
    const product = new Product(new ProductId('p-1'), 'Widget', 100);
    const result = service.applyDiscount(product, 20);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(80);
  });

  it('service returns Err when business rule is violated', () => {
    const product = new Product(new ProductId('p-2'), 'Widget', 100);
    const result = service.applyDiscount(product, 150);
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('invalid_discount');
  });

  it('service can aggregate multiple entities', () => {
    const products = [
      new Product(new ProductId('a'), 'A', 100),
      new Product(new ProductId('b'), 'B', 200),
    ];
    const result = service.bulkPrice(products, 10);
    expect(result.unwrap()).toBe(270);
  });
});

// ---------------------------------------------------------------------------
// Suite 4: Policy
// ---------------------------------------------------------------------------

class PriceToDiscountPolicy extends Policy<number, number> {
  constructor(private readonly threshold: number, private readonly pct: number) {
    super();
  }
  apply(price: number): number {
    return price >= this.threshold ? price * (this.pct / 100) : 0;
  }
}

class RoundPolicy extends Policy<number, number> {
  apply(input: number): number {
    return Math.round(input * 100) / 100;
  }
}

class DoublePolicy extends Policy<number, number> {
  apply(input: number): number {
    return input * 2;
  }
}

describe('Policy', () => {
  it('apply() returns the correct result for qualifying input', () => {
    const policy = new PriceToDiscountPolicy(50, 10);
    expect(policy.apply(100)).toBe(10);
  });

  it('apply() returns zero when input does not meet threshold', () => {
    const policy = new PriceToDiscountPolicy(50, 10);
    expect(policy.apply(30)).toBe(0);
  });

  it('andThen() composes two policies in sequence', () => {
    const discount = new PriceToDiscountPolicy(50, 10); // 100 → 10
    const round = new RoundPolicy(); // 10.0 → 10
    const composed = discount.andThen(round);
    expect(composed.apply(100)).toBe(10);
  });

  it('andThen() chains three policies correctly', () => {
    const discount = new PriceToDiscountPolicy(50, 10); // 100 → 10
    const doubled = new DoublePolicy(); // 10 → 20
    const rounded = new RoundPolicy(); // 20 → 20
    const pipeline = discount.andThen(doubled).andThen(rounded);
    expect(pipeline.apply(100)).toBe(20);
  });

  it('policy is stateless — repeated calls return the same result', () => {
    const policy = new PriceToDiscountPolicy(50, 20);
    expect(policy.apply(200)).toBe(40);
    expect(policy.apply(200)).toBe(40);
  });
});
