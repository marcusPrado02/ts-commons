/* eslint-disable
   @typescript-eslint/no-unsafe-return,
   @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/strict-boolean-expressions
   -- Permission extends ValueObject<string> from @acme/kernel; `.value` is
   typed correctly at compile time but may appear as `any` to the ESLint TS
   plugin due to the TypeScript 5.9.x / plugin <5.4 version mismatch. */
import type { AuthenticatedPrincipal } from '../authn/AuthenticatedPrincipal';
import type { PolicyEnginePort } from './PolicyEnginePort';
import { PolicyDecision } from './PolicyEnginePort';
import type { Permission } from './Permission';

/**
 * Role-Based Access Control (RBAC) policy engine.
 *
 * Maps role names to lists of permission strings. A request is `ALLOW`ed when
 * at least one of the principal's roles grants the required permission.
 *
 * @example
 * ```typescript
 * const engine = new RbacPolicyEngine({
 *   admin:  ['user:read', 'user:write', 'user:delete'],
 *   viewer: ['user:read'],
 * });
 *
 * const decision = await engine.evaluate(
 *   principal,
 *   Permission.create('user:read'),
 * );
 * // PolicyDecision.ALLOW if principal has 'admin' or 'viewer' role
 * ```
 */
export class RbacPolicyEngine implements PolicyEnginePort {
  constructor(
    private readonly rolePermissions: Readonly<Record<string, readonly string[]>>,
  ) {}

  evaluate(principal: AuthenticatedPrincipal, permission: Permission): Promise<PolicyDecision> {
    const required = permission.value;

    const hasPermission = principal.roles.some((role) => {
      const perms = this.rolePermissions[role];
      return perms !== undefined && perms.includes(required);
    });

    return Promise.resolve(hasPermission ? PolicyDecision.ALLOW : PolicyDecision.DENY);
  }
}
