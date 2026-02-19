import type { TenantId } from '../identity/TenantId';
import type { Entity } from '../ddd/Entity';
import type { Specification } from '../ddd/Specification';
import type { TenantIsolationDescriptor } from './TenantIsolation';

/**
 * Contract for repositories that scope every operation to a specific tenant.
 *
 * All methods receive an explicit `tenantId` so the repository can enforce
 * isolation regardless of whether a {@link TenantContext} is active.
 */
export interface TenantAwareRepository<T extends Entity<TId>, TId> {
  readonly isolation: TenantIsolationDescriptor;

  findById(tenantId: TenantId, id: TId): Promise<T | undefined>;
  findBy(tenantId: TenantId, spec: Specification<T>): Promise<T[]>;
  save(tenantId: TenantId, entity: T): Promise<void>;
  delete(tenantId: TenantId, id: TId): Promise<void>;
  exists(tenantId: TenantId, spec: Specification<T>): Promise<boolean>;
}

/**
 * Abstract base providing a default `exists` implementation via `findBy`.
 */
export abstract class AbstractTenantAwareRepository<T extends Entity<TId>, TId>
  implements TenantAwareRepository<T, TId>
{
  abstract readonly isolation: TenantIsolationDescriptor;

  abstract findById(tenantId: TenantId, id: TId): Promise<T | undefined>;
  abstract findBy(tenantId: TenantId, spec: Specification<T>): Promise<T[]>;
  abstract save(tenantId: TenantId, entity: T): Promise<void>;
  abstract delete(tenantId: TenantId, id: TId): Promise<void>;

  async exists(tenantId: TenantId, spec: Specification<T>): Promise<boolean> {
    const results = await this.findBy(tenantId, spec);
    return results.length > 0;
  }
}
