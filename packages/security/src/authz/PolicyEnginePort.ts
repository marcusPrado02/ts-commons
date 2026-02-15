export enum PolicyDecision {
  ALLOW = 'ALLOW',
  DENY = 'DENY',
}

export interface PolicyEnginePort {
  evaluate(principal: unknown, resource: unknown, action: string): Promise<PolicyDecision>;
}
