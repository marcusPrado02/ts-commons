import { AsyncLocalStorage } from 'node:async_hooks';
import { Option } from '../primitives/Option';
import type { TenantId } from '../identity/TenantId';

/**
 * Thread-local (AsyncLocalStorage) context for propagating the current
 * {@link TenantId} across async boundaries without explicit parameter
 * threading.
 *
 * @example
 * ```ts
 * await TenantContext.run(TenantId.create('acme'), async () => {
 *   const tenant = TenantContext.current().unwrap();
 *   // ...
 * });
 * ```
 */
export class TenantContext {
  private static readonly storage = new AsyncLocalStorage<TenantId>();

  /** Runs `fn` with the given tenant as the current context. */
  static run<T>(tenantId: TenantId, fn: () => T): T {
    return this.storage.run(tenantId, fn);
  }

  /**
   * Returns the current tenant as `Option.some(id)`, or `Option.none()` when
   * called outside a {@link run} scope.
   */
  static current(): Option<TenantId> {
    return Option.fromNullable(this.storage.getStore());
  }

  /** Returns `true` when there is an active tenant context. */
  static hasTenant(): boolean {
    return this.storage.getStore() !== undefined;
  }
}
