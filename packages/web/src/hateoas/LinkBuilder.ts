import type { Link } from './Link';

/**
 * Fluent builder for creating {@link Link} objects.
 *
 * @example
 * ```ts
 * const link = new LinkBuilder('https://api.acme.com/orders/1', 'self')
 *   .withMethod('GET')
 *   .withTitle('View order')
 *   .build();
 * ```
 */
export class LinkBuilder {
  private readonly _href: string;
  private readonly _rel: string;
  private _method?: string;
  private _title?: string;
  private _type?: string;

  constructor(href: string, rel: string) {
    this._href = href;
    this._rel = rel;
  }

  withMethod(method: string): this {
    this._method = method;
    return this;
  }

  withTitle(title: string): this {
    this._title = title;
    return this;
  }

  withType(type: string): this {
    this._type = type;
    return this;
  }

  build(): Link {
    const link: Link = { href: this._href, rel: this._rel };

    const result: Record<string, unknown> = { href: link.href, rel: link.rel };
    if (this._method !== undefined) result['method'] = this._method;
    if (this._title !== undefined) result['title'] = this._title;
    if (this._type !== undefined) result['type'] = this._type;

    return result as unknown as Link;
  }

  /** Convenience factory for a `self` link. */
  static self(href: string): Link {
    return { href, rel: 'self' };
  }

  /** Convenience factory for a `collection` link. */
  static collection(href: string): Link {
    return { href, rel: 'collection' };
  }

  /** Convenience factory for a link with a custom relation. */
  static related(rel: string, href: string): Link {
    return { href, rel };
  }
}
