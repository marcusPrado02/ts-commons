import type { OAuthClientConfig, TokenIntrospectionResult } from './types';

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

function parseString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function parseNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

/**
 * OAuth2 Token Introspection — RFC 7662.
 * Also provides token revocation per RFC 7009.
 */
export class TokenIntrospector {
  constructor(
    private readonly config: OAuthClientConfig,
    private readonly fetch: FetchFn,
  ) {}

  /**
   * Introspect a token to check if it is active and retrieve its claims.
   */
  async introspect(token: string, tokenTypeHint?: string): Promise<TokenIntrospectionResult> {
    if (this.config.introspectionEndpoint == null) {
      throw new Error('introspectionEndpoint required for token introspection');
    }

    const body = new URLSearchParams({ token });
    if (tokenTypeHint != null) body.set('token_type_hint', tokenTypeHint);
    this.appendClientAuth(body);

    const response = await this.fetch(this.config.introspectionEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Introspection request failed: ${response.status}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.parseIntrospectionData(data);
  }

  private parseIntrospectionData(data: Record<string, unknown>): TokenIntrospectionResult {
    return {
      active: data['active'] === true,
      ...this.parseIntrospectionOptionals(data),
    };
  }

  private parseIntrospectionOptionals(
    data: Record<string, unknown>,
  ): Partial<TokenIntrospectionResult> {
    const sub = parseString(data['sub']);
    const clientId = parseString(data['client_id']);
    const scope = parseString(data['scope']);
    const exp = parseNumber(data['exp']);
    const username = parseString(data['username']);
    const tokenType = parseString(data['token_type']);
    return {
      ...(sub === undefined ? {} : { sub }),
      ...(clientId === undefined ? {} : { clientId }),
      ...(scope === undefined ? {} : { scope }),
      ...(exp === undefined ? {} : { exp }),
      ...(username === undefined ? {} : { username }),
      ...(tokenType === undefined ? {} : { tokenType }),
    };
  }

  async revoke(token: string, tokenTypeHint?: string): Promise<void> {
    if (this.config.revocationEndpoint == null) {
      throw new Error('revocationEndpoint required for token revocation');
    }

    const body = new URLSearchParams({ token });
    if (tokenTypeHint != null) body.set('token_type_hint', tokenTypeHint);
    this.appendClientAuth(body);

    const response = await this.fetch(this.config.revocationEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Revocation request failed: ${response.status}`);
    }
  }

  private appendClientAuth(body: URLSearchParams): void {
    body.set('client_id', this.config.clientId);
    if (this.config.clientSecret != null) {
      body.set('client_secret', this.config.clientSecret);
    }
  }
}
