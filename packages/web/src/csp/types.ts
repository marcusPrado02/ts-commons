export type CspDirective =
  | 'default-src'
  | 'script-src'
  | 'style-src'
  | 'img-src'
  | 'connect-src'
  | 'font-src'
  | 'object-src'
  | 'media-src'
  | 'frame-src'
  | 'worker-src'
  | 'manifest-src'
  | 'form-action'
  | 'frame-ancestors'
  | 'base-uri'
  | 'upgrade-insecure-requests'
  | 'block-all-mixed-content';

/** A CSP source value — keyword, scheme, origin, nonce or hash. */
export type CspSource = string;

export type CspPolicy = Partial<Record<CspDirective, CspSource[]>>;

export interface CspOptions {
  /** Whether to add upgrade-insecure-requests directive */
  readonly upgradeInsecureRequests?: boolean;
  /** Whether to add block-all-mixed-content directive */
  readonly blockAllMixedContent?: boolean;
  /** Report-URI for violation reports */
  readonly reportUri?: string;
  /** Report-To group name (CSP Level 3) */
  readonly reportTo?: string;
}

export interface CspViolationReport {
  readonly blockedUri: string;
  readonly documentUri: string;
  readonly effectiveDirective: string;
  readonly originalPolicy: string;
  readonly referrer?: string;
  readonly statusCode?: number;
  readonly violatedDirective: string;
}
