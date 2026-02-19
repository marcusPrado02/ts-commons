import type { AuthenticatedPrincipal } from '../authn/AuthenticatedPrincipal';
import type { Permission } from './Permission';

export enum PolicyDecision {
  ALLOW = 'ALLOW',
  DENY = 'DENY',
}

export interface PolicyEnginePort {
  evaluate(principal: AuthenticatedPrincipal, permission: Permission): Promise<PolicyDecision>;
}
