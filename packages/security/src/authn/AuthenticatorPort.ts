import type { AuthenticatedPrincipal } from './AuthenticatedPrincipal';

export interface AuthenticatorPort {
  authenticate(token: string): Promise<AuthenticatedPrincipal | null>;
}
