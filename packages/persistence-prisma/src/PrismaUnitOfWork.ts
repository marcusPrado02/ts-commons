/**
 * Unit of Work pattern for Prisma transactions.
 *
 * Wraps the Prisma `$transaction` API so that application code can execute
 * multiple repository operations inside a single ACID transaction.
 */
/* eslint-disable @typescript-eslint/no-unsafe-return -- Prisma $transaction callback returns inferred T */
import type { Result } from '@acme/kernel';

/**
 * Minimal structural interface for a PrismaClient instance.
 * Pass your generated `PrismaClient` directly; it will satisfy this interface.
 */
export interface PrismaClientLike {
  $transaction<T>(fn: (tx: PrismaClientLike) => Promise<T>): Promise<T>;
  $disconnect(): Promise<void>;
  $connect(): Promise<void>;
}

/**
 * Unit of Work that delegates to Prisma's interactive transactions.
 *
 * @example
 * ```typescript
 * const unitOfWork = new PrismaUnitOfWork(prisma);
 *
 * await unitOfWork.transaction(async (tx) => {
 *   const userRepo = new UserRepository(tx.user, userMapper);
 *   const orderRepo = new OrderRepository(tx.order, orderMapper);
 *
 *   await userRepo.save(user);
 *   await orderRepo.save(order);
 *   // Both writes are committed atomically
 * });
 * ```
 */
export class PrismaUnitOfWork {
  constructor(private readonly prisma: PrismaClientLike) {}

  /**
   * Execute work inside a Prisma interactive transaction.
   * The transaction is committed on success and rolled back on error.
   */
  async transaction<T>(work: (tx: PrismaClientLike) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  /**
   * Execute work inside a transaction returning a Result type.
   * Useful when the work function uses domain Result<T, E> instead of throwing.
   *
   * Note: exceptions thrown inside `work` will still propagate.
   */
  async transactionResult<T, E extends Error>(
    work: (tx: PrismaClientLike) => Promise<Result<T, E>>,
  ): Promise<Result<T, E>> {
    return this.prisma.$transaction(work);
  }

  /**
   * Expose the underlying Prisma client for advanced operations.
   */
  getClient(): PrismaClientLike {
    return this.prisma;
  }

  /**
   * Disconnect from the database (frees connection pool).
   * Call during application shutdown.
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  /**
   * Explicitly connect to the database.
   * Prisma connects lazily on first query; call this for eager connection.
   */
  async connect(): Promise<void> {
    await this.prisma.$connect();
  }
}
