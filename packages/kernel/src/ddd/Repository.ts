import type { Entity } from './Entity';
import type { Specification } from './Specification';

/**
 * Generic repository interface following the DDD Repository pattern.
 * Hides storage details from the domain layer; the domain only sees entities.
 *
 * @template T   The aggregate / entity type managed by this repository.
 * @template TId The identifier type of T.
 */
export interface Repository<T extends Entity<TId>, TId> {
  /** Returns the entity with the given id, or `undefined` if not found. */
  findById(id: TId): Promise<T | undefined>;

  /** Returns all entities that satisfy the given specification. */
  findBy(spec: Specification<T>): Promise<T[]>;

  /** Persists a new or updated entity. */
  save(entity: T): Promise<void>;

  /** Removes the entity with the given id. */
  delete(id: TId): Promise<void>;

  /** Returns true if at least one entity satisfies the specification. */
  exists(spec: Specification<T>): Promise<boolean>;
}

/**
 * Abstract base implementation of {@link Repository}.
 *
 * Provides a default `exists()` built on top of `findBy()` so concrete
 * repositories only need to implement the four core operations.
 *
 * @example
 * ```ts
 * class InMemoryUserRepository extends AbstractRepository<User, UserId> {
 *   private store = new Map<string, User>();
 *
 *   async findById(id: UserId) { return this.store.get(id.value); }
 *   async findBy(spec: Specification<User>) {
 *     return [...this.store.values()].filter(u => spec.isSatisfiedBy(u));
 *   }
 *   async save(user: User) { this.store.set(user.id.value, user); }
 *   async delete(id: UserId) { this.store.delete(id.value); }
 * }
 * ```
 */
export abstract class AbstractRepository<T extends Entity<TId>, TId>
  implements Repository<T, TId>
{
  abstract findById(id: TId): Promise<T | undefined>;
  abstract findBy(spec: Specification<T>): Promise<T[]>;
  abstract save(entity: T): Promise<void>;
  abstract delete(id: TId): Promise<void>;

  async exists(spec: Specification<T>): Promise<boolean> {
    const results = await this.findBy(spec);
    return results.length > 0;
  }
}
