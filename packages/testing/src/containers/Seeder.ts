/**
 * Port for seeding a data store with initial data before a test.
 *
 * Implementations should be idempotent or use transactions to avoid
 * state leaking between test cases.
 */
export interface Seeder {
  /** Populates the data store with test data. */
  seed(): Promise<void>;
}

/**
 * Runs multiple {@link Seeder} instances sequentially in the order they
 * were added.
 *
 * @example
 * ```typescript
 * const seeder = new CompositeSeeder()
 *   .add(new UserSeeder(pool))
 *   .add(new ProductSeeder(pool));
 *
 * beforeEach(() => seeder.seed());
 * ```
 */
export class CompositeSeeder implements Seeder {
  private readonly seeders: Seeder[] = [];

  /**
   * Appends a seeder and returns `this` for fluent chaining.
   */
  add(seeder: Seeder): this {
    this.seeders.push(seeder);
    return this;
  }

  /** Runs each registered seeder in the order they were added. */
  async seed(): Promise<void> {
    for (const seeder of this.seeders) {
      await seeder.seed();
    }
  }

  /** Returns the number of registered seeders. */
  size(): number {
    return this.seeders.length;
  }
}
