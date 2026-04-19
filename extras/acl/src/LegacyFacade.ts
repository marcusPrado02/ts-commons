import { AclException } from './AclException.js';

export { AclException };

/**
 * Abstract base class for legacy-system facades.
 *
 * Subclasses wrap a legacy client `TClient` and expose methods that speak
 * the domain language.  All interactions with the legacy client must go
 * through {@link LegacyFacade.execute} so that errors are consistently mapped
 * to {@link AclException} instances.
 *
 * @example
 * class UserServiceFacade extends LegacyFacade<LegacyUserClient> {
 *   async getUser(id: string): Promise<User> {
 *     return this.execute(() => this.client.fetchUser(id));
 *   }
 *   protected mapError(error: unknown): AclException {
 *     return new AclException('LEGACY_USER_ERROR', String(error), error);
 *   }
 * }
 */
export abstract class LegacyFacade<TClient> {
  constructor(protected readonly client: TClient) {}

  /**
   * Sub-classes implement this to translate raw legacy errors into
   * structured {@link AclException} instances.
   */
  protected abstract mapError(error: unknown): AclException;

  /**
   * Execute a legacy operation, mapping any thrown error through
   * {@link LegacyFacade.mapError} before re-throwing.
   */
  protected async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (err) {
      throw this.mapError(err);
    }
  }
}
