import type { OAuthClientConfig, TokenResponse } from './types';

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * OAuth2 Client Credentials flow — server-to-server authentication.
 */
export class ClientCredentialsFlow {
  constructor(
    private readonly config: OAuthClientConfig,
    private readonly fetch: FetchFn,
  ) {}

  async getToken(additionalScopes?: string[]): Promise<TokenResponse> {
    const scopes = [...(this.config.scopes ?? []), ...(additionalScopes ?? [])];

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
    });

    if (this.config.clientSecret != null) body.set('client_secret', this.config.clientSecret);
    if (scopes.length > 0) body.set('scope', scopes.join(' '));

    const response = await this.fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(
        `Client credentials request failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    return {
      accessToken: typeof data['access_token'] === 'string' ? data['access_token'] : '',
      tokenType: typeof data['token_type'] === 'string' ? data['token_type'] : 'Bearer',
      expiresIn: typeof data['expires_in'] === 'number' ? data['expires_in'] : undefined,
      scope: typeof data['scope'] === 'string' ? data['scope'] : undefined,
    };
  }
}
