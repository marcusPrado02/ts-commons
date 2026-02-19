/**
 * Strategy used to isolate tenant data at the infrastructure level.
 *
 * | Strategy             | Description                          |
 * |----------------------|--------------------------------------|
 * | `DATABASE_PER_TENANT`| Separate database per tenant         |
 * | `SCHEMA_PER_TENANT`  | Separate schema per tenant           |
 * | `ROW_PER_TENANT`     | Shared tables, discriminated by row  |
 */
export enum TenantIsolationStrategy {
  DATABASE_PER_TENANT = 'database_per_tenant',
  SCHEMA_PER_TENANT = 'schema_per_tenant',
  ROW_PER_TENANT = 'row_per_tenant',
}

/**
 * Runtime descriptor attached to a repository or service, indicating how
 * tenant isolation is achieved.
 */
export interface TenantIsolationDescriptor {
  readonly strategy: TenantIsolationStrategy;
  /** For `ROW_PER_TENANT`: the name of the discriminator column / field. */
  readonly discriminatorField?: string;
}
