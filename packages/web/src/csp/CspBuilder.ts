import type { CspDirective, CspOptions, CspPolicy, CspSource } from './types';

/**
 * Fluent CSP policy builder.
 *
 * @example
 * const header = new CspBuilder()
 *   .add('default-src', ["'none'"])
 *   .add('script-src', ["'self'", nonce])
 *   .add('style-src', ["'self'"])
 *   .withOptions({ upgradeInsecureRequests: true, reportUri: '/csp-report' })
 *   .build();
 */
export class CspBuilder {
  private readonly policy: Map<CspDirective, Set<CspSource>> = new Map();
  private options: CspOptions = {};

  /** Add sources for a directive (cumulative). */
  add(directive: CspDirective, sources: CspSource[]): this {
    const existing = this.policy.get(directive) ?? new Set<CspSource>();
    for (const src of sources) existing.add(src);
    this.policy.set(directive, existing);
    return this;
  }

  /** Set global CSP options. */
  withOptions(opts: CspOptions): this {
    this.options = { ...this.options, ...opts };
    return this;
  }

  /** Build the Content-Security-Policy header value. */
  build(): string {
    const parts: string[] = [];

    for (const [directive, sources] of this.policy) {
      const srcList = [...sources].join(' ');
      parts.push(srcList.length > 0 ? `${directive} ${srcList}` : directive);
    }

    if (this.options.upgradeInsecureRequests === true) {
      parts.push('upgrade-insecure-requests');
    }
    if (this.options.blockAllMixedContent === true) {
      parts.push('block-all-mixed-content');
    }
    if (this.options.reportUri != null) {
      parts.push(`report-uri ${this.options.reportUri}`);
    }
    if (this.options.reportTo != null) {
      parts.push(`report-to ${this.options.reportTo}`);
    }

    return parts.join('; ');
  }

  /** Clone current builder state. */
  clone(): CspBuilder {
    const next = new CspBuilder();
    for (const [dir, srcs] of this.policy) {
      next.add(dir, [...srcs]);
    }
    next.withOptions({ ...this.options });
    return next;
  }

  /** Return the current policy as a plain object. */
  toPolicy(): CspPolicy {
    const out: CspPolicy = {};
    for (const [directive, sources] of this.policy) {
      out[directive] = [...sources];
    }
    return out;
  }

  /** Parse a raw CSP header string back into a builder. */
  static parse(header: string): CspBuilder {
    const builder = new CspBuilder();
    const directives = header
      .split(';')
      .map((d) => d.trim())
      .filter((d) => d.length > 0);
    for (const directive of directives) {
      const [name, ...sources] = directive.split(/\s+/);
      if (name == null) continue;
      builder.add(name as CspDirective, sources);
    }
    return builder;
  }
}
