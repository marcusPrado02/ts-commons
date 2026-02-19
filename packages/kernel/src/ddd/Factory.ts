import type { Result } from '../primitives/Result';
import type { DomainError } from '../errors/DomainError';

/**
 * Abstract factory for creating domain objects.
 * Factories encapsulate complex creation logic and enforce invariants,
 * returning a typed `Result` so callers handle failure without exceptions.
 *
 * @template T      The domain object type this factory produces.
 * @template TProps The input properties used to construct T.
 *
 * @example
 * ```ts
 * class UserFactory extends Factory<User, { email: string; name: string }> {
 *   create(props: { email: string; name: string }): Result<User, DomainError> {
 *     if (!props.email.includes('@')) {
 *       return Result.err(new InvalidEmailError(props.email));
 *     }
 *     return Result.ok(new User(UUID.generate(), props.email, props.name));
 *   }
 * }
 * ```
 */
export abstract class Factory<T, TProps = unknown> {
  /**
   * Creates a domain object from the given properties.
   * Returns `Ok` with the created instance, or `Err` with a `DomainError`
   * if the provided props violate domain invariants.
   */
  abstract create(props: TProps): Result<T, DomainError>;
}
