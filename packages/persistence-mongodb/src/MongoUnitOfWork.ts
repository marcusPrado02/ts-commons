/**
 * Unit of Work pattern for MongoDB multi-document transactions.
 *
 * Wraps the MongoDB `ClientSession.withTransaction()` API so that application
 * code can execute multiple collection operations inside a single ACID
 * transaction (requires a MongoDB replica set or sharded cluster).
 */
import type { Result } from '@acme/kernel';

// ── Structural interfaces ─────────────────────────────────────────────────────

/**
 * Structural interface for a MongoDB ClientSession.
 * Any `ClientSession` object from the `mongodb` driver satisfies this.
 */
export interface MongoSessionLike {
  /** Execute a callback inside a MongoDB transaction. Auto-retries on transient errors. */
  withTransaction<T>(fn: () => Promise<T>): Promise<T>;
  /** Release the session back to the pool. Always call in a finally block. */
  endSession(): Promise<void>;
}

/**
 * Structural interface for a MongoDB MongoClient.
 * Pass your `new MongoClient(uri)` instance; it will satisfy this interface.
 */
export interface MongoClientLike {
  startSession(): MongoSessionLike;
}

// ── Unit of Work ──────────────────────────────────────────────────────────────

/**
 * Unit of Work that delegates to MongoDB interactive transactions.
 *
 * Requires a MongoDB replica set or sharded cluster (transactions are not
 * available on standalone MongoDB instances in production).
 *
 * @example
 * ```typescript
 * const uow = new MongoUnitOfWork(client);
 *
 * await uow.withTransaction(async (session) => {
 *   await userCollection.insertOne(userDoc, { session });
 *   await orderCollection.insertOne(orderDoc, { session });
 *   // Committed atomically on success; rolled back on error
 * });
 * ```
 */
export class MongoUnitOfWork {
  constructor(private readonly client: MongoClientLike) {}

  /**
   * Execute work inside a MongoDB transaction.
   * The transaction is committed on success and rolled back on error.
   * The session is always released via `endSession()`.
   *
   * @param work - Callback that receives the active session.
   */
  async withTransaction<T>(work: (session: MongoSessionLike) => Promise<T>): Promise<T> {
    const session = this.client.startSession();
    try {
      return await session.withTransaction(() => work(session));
    } finally {
      await session.endSession();
    }
  }

  /**
   * Execute work inside a transaction returning a `Result<T, E>` type.
   * Useful when the work function uses domain Result types instead of throwing.
   *
   * @param work - Callback returning `Result<T, E>`.
   */
  async withTransactionResult<T, E extends Error>(
    work: (session: MongoSessionLike) => Promise<Result<T, E>>,
  ): Promise<Result<T, E>> {
    return this.withTransaction(work);
  }

  /** Expose the underlying `MongoClientLike` for advanced use-cases. */
  getClient(): MongoClientLike {
    return this.client;
  }
}
