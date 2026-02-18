/**
 * Abstract MongoDB repository implementing Clean Architecture repository port.
 *
 * Accepts a structural `MongoCollectionLike` (e.g. `db.collection('users')`)
 * instead of the typed MongoDB `Collection<TDoc>`, keeping the library
 * independent of generated driver types.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- MongoDB framework boundary: collection methods return any */
/* eslint-disable @typescript-eslint/no-unsafe-call -- MongoDB framework boundary: collection method calls */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- MongoDB framework boundary: document property access */
import type { RepositoryPort } from '@acme/persistence';
import type { MongoMapper } from './MongoMapper';

// ── Structural cursor interface ───────────────────────────────────────────────

/**
 * Structural interface matching the MongoDB cursor's fluent chaining API.
 * All chaining methods mutate and return the cursor (fluent API).
 *
 * Pass `db.collection('users').find(filter)` (cast to this interface).
 */
export interface MongoCursorLike {
  sort(sort: Record<string, 1 | -1>): MongoCursorLike;
  skip(n: number): MongoCursorLike;
  limit(n: number): MongoCursorLike;
  toArray(): Promise<Record<string, unknown>[]>;
}

// ── Structural collection interface ──────────────────────────────────────────

/**
 * Structural interface matching the subset of MongoDB `Collection<Document>`
 * methods used by this library.
 *
 * Pass `db.collection('users') as unknown as MongoCollectionLike`.
 */
export interface MongoCollectionLike {
  findOne(filter: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  find(filter?: Record<string, unknown>): MongoCursorLike;
  replaceOne(
    filter: Record<string, unknown>,
    replacement: Record<string, unknown>,
    options: { upsert: boolean },
  ): Promise<unknown>;
  deleteOne(filter: Record<string, unknown>): Promise<unknown>;
  countDocuments(filter?: Record<string, unknown>): Promise<number>;
}

// ── Abstract repository ───────────────────────────────────────────────────────

/**
 * Abstract base repository for MongoDB native driver.
 *
 * Subclasses must implement two abstract methods that map between the domain ID
 * value object and the MongoDB filter:
 * - `extractId(entity)` — return the ID from a domain entity
 * - `getFilter(id)` — return a MongoDB filter `{ _id: id.value }` (or any field)
 *
 * @template TDomain - Domain entity type
 * @template TId     - ID value object type
 *
 * @example
 * ```typescript
 * class UserRepository extends MongoRepository<User, UserId> {
 *   constructor(db: Db, mapper: UserMongoMapper) {
 *     super(db.collection('users') as unknown as MongoCollectionLike, mapper);
 *   }
 *
 *   protected extractId(entity: User): UserId { return entity.id; }
 *
 *   protected getFilter(id: UserId): Record<string, unknown> {
 *     return { _id: id.value };
 *   }
 * }
 * ```
 */
export abstract class MongoRepository<TDomain, TId>
  implements RepositoryPort<TDomain, TId>
{
  constructor(
    protected readonly collection: MongoCollectionLike,
    protected readonly mapper: MongoMapper<TDomain>,
  ) {}

  /**
   * Extract the ID value object from a domain entity.
   * Used internally by `save()` to build the upsert filter.
   */
  protected abstract extractId(entity: TDomain): TId;

  /**
   * Build a MongoDB filter document for the given ID.
   *
   * @example
   * ```typescript
   * protected getFilter(id: UserId): Record<string, unknown> {
   *   return { _id: id.value };
   * }
   * ```
   */
  protected abstract getFilter(id: TId): Record<string, unknown>;

  /**
   * Persist a domain entity (insert or replace).
   * Uses `replaceOne` with `{ upsert: true }` so callers do not need to
   * distinguish new vs existing documents.
   */
  async save(entity: TDomain): Promise<void> {
    const id = this.extractId(entity);
    const doc = this.mapper.toDocument(entity);
    await this.collection.replaceOne(this.getFilter(id), doc, { upsert: true });
  }

  /**
   * Find a domain entity by its ID.
   * Returns `null` when no document matches.
   */
  async findById(id: TId): Promise<TDomain | null> {
    const doc = await this.collection.findOne(this.getFilter(id));
    if (doc === null) return null;
    return this.mapper.toDomain(doc);
  }

  /**
   * Return all documents in the collection mapped to domain entities.
   * Add a `where` filter by overriding this method in subclasses when needed.
   */
  async findAll(): Promise<TDomain[]> {
    const docs = await this.collection.find().skip(0).limit(0).toArray();
    return docs.map((d) => this.mapper.toDomain(d));
  }

  /** Return `true` if a document with the given ID exists. */
  async exists(id: TId): Promise<boolean> {
    const count = await this.collection.countDocuments(this.getFilter(id));
    return count > 0;
  }

  /** Delete the document matching the given ID. */
  async delete(id: TId): Promise<void> {
    await this.collection.deleteOne(this.getFilter(id));
  }
}
