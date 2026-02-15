export interface AuthenticatedPrincipal {
  readonly id: string;
  readonly tenantId?: string;
  readonly roles: string[];
  readonly permissions: string[];
}
