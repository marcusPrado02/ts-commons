import type { OAuthClientConfig, PkceChallenge, TokenResponse } from './types';

/**
 * OAuth2 Authorization Code flow utilities.
 * Handles building authorization URLs and exchanging codes for tokens.
 * Network calls are abstracted through injected fetch-like function.
 */

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

function extractString(data: Record<string, unknown>, key: string): string | undefined {
  return typeof data[key] === 'string' ? data[key] : undefined;
}

export class AuthorizationCodeFlow {
  constructor(
    private readonly config: OAuthClientConfig,
    private readonly fetch: FetchFn,
  ) {}

  buildAuthorizationUrl(state: string, pkce?: PkceChallenge): string {
    if (this.config.authorizationEndpoint == null) {
      throw new Error('authorizationEndpoint required for Authorization Code flow');
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      state,
    });

    if (this.config.redirectUri != null) params.set('redirect_uri', this.config.redirectUri);
    if (this.config.scopes != null) params.set('scope', this.config.scopes.join(' '));
    if (pkce != null) {
      params.set('code_challenge', pkce.codeChallenge);
      params.set('code_challenge_method', pkce.codeChallengeMethod);
    }

    return `${this.config.authorizationEndpoint}?${params.toString()}`;
  }

  async exchangeCode(code: string, codeVerifier?: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.config.clientId,
    });

    if (this.config.redirectUri != null) body.set('redirect_uri', this.config.redirectUri);
    if (this.config.clientSecret != null) body.set('client_secret', this.config.clientSecret);
    if (codeVerifier != null) body.set('code_verifier', codeVerifier);

    return this.postToken(body);
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
    });
    if (this.config.clientSecret != null) body.set('client_secret', this.config.clientSecret);
    return this.postToken(body);
  }

  private async postToken(body: URLSearchParams): Promise<TokenResponse> {
    const response = await this.fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return {
      accessToken: extractString(data, 'access_token') ?? '',
      tokenType: extractString(data, 'token_type') ?? 'Bearer',
      expiresIn: typeof data['expires_in'] === 'number' ? data['expires_in'] : undefined,
      refreshToken: extractString(data, 'refresh_token'),
      scope: extractString(data, 'scope'),
      idToken: extractString(data, 'id_token'),
    };
  }
}
