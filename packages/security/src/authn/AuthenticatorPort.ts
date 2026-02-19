import type { Result } from '@acme/kernel';
import type { AuthenticatedPrincipal } from './AuthenticatedPrincipal';
import type { AuthError } from './AuthErrors';

export interface AuthenticatorPort {
  authenticate(token: string): Promise<Result<AuthenticatedPrincipal, AuthError>>;
}
