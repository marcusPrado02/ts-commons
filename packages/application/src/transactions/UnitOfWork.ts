/**
 * Unit of Work pattern for transactional boundaries.
 */
export interface UnitOfWork {
  /**
   * Begin a new transaction.
   */
  begin(): Promise<void>;

  /**
   * Commit the transaction.
   */
  commit(): Promise<void>;

  /**
   * Rollback the transaction.
   */
  rollback(): Promise<void>;

  /**
   * Execute work within a transaction.
   */
  execute<T>(work: () => Promise<T>): Promise<T>;
}
