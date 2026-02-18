/**
 * Unit of Work pattern implementation for TypeORM
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- TypeORM framework boundary: DataSource and transaction methods */
/* eslint-disable @typescript-eslint/no-unsafe-call -- TypeORM framework boundary: transaction methods */
/* eslint-disable @typescript-eslint/no-unsafe-return -- TypeORM framework boundary: transaction callback returns any */
import type { DataSource, EntityManager } from 'typeorm';
import type { Result } from '@acme/kernel';

/**
 * Unit of Work for managing transactions in TypeORM
 *
 * @example
 * ```typescript
 * const unitOfWork = new TypeORMUnitOfWork(dataSource);
 *
 * await unitOfWork.transaction(async (manager) => {
 *   const userRepo = manager.getRepository(UserEntity);
 *   const orderRepo = manager.getRepository(OrderEntity);
 *
 *   await userRepo.save(user);
 *   await orderRepo.save(order);
 *
 *   // Both saves are committed together
 * });
 * ```
 */
export class TypeORMUnitOfWork {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Execute work within a transaction
   * All operations are committed if successful, rolled back on error
   */
  async transaction<T>(
    work: (manager: EntityManager) => Promise<T>
  ): Promise<T> {
    return await this.dataSource.transaction(work);
  }

  /**
   * Execute work within a transaction with Result type
   * Returns Result.ok on success, Result.err on failure
   *
   * Note: The work function should handle errors internally and return Result.err()
   * Any exceptions thrown will propagate normally.
   */
  async transactionResult<T, E extends Error>(
    work: (manager: EntityManager) => Promise<Result<T, E>>
  ): Promise<Result<T, E>> {
    return await this.dataSource.transaction(work);
  }

  /**
   * Get the DataSource for advanced operations
   */
  getDataSource(): DataSource {
    return this.dataSource;
  }

  /**
   * Check if DataSource is initialized
   */
  isInitialized(): boolean {
    return this.dataSource.isInitialized;
  }
}
