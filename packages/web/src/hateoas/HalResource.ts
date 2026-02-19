import type { Link } from './Link';
import { LinkBuilder } from './LinkBuilder';

/**
 * A HAL (Hypertext Application Language) document.
 * Follows the JSON+HAL spec: https://datatracker.ietf.org/doc/html/draft-kelly-json-hal
 */
export interface HalDocument {
  readonly _links?: Record<string, Link | Link[]>;
  readonly _embedded?: Record<string, HalDocument | HalDocument[]>;
}

/**
 * Wraps a data object with HAL hypermedia controls.
 *
 * @example
 * ```ts
 * const resource = new HalResource({ id: '1', name: 'Alice' }, 'https://api.acme.com/users/1')
 *   .addLink('users', LinkBuilder.collection('https://api.acme.com/users'))
 *   .toDocument();
 * ```
 */
export class HalResource<T extends object> {
  private readonly data: T;
  private readonly links: Map<string, Link | Link[]>;
  private readonly embedded: Map<string, HalDocument | HalDocument[]>;

  constructor(data: T, selfHref: string) {
    this.data = data;
    this.links = new Map<string, Link | Link[]>();
    this.embedded = new Map<string, HalDocument | HalDocument[]>();
    this.links.set('self', LinkBuilder.self(selfHref));
  }

  addLink(rel: string, link: Link | Link[]): this {
    this.links.set(rel, link);
    return this;
  }

  embed(rel: string, resource: HalDocument | HalDocument[]): this {
    this.embedded.set(rel, resource);
    return this;
  }

  toDocument(): T & HalDocument {
    const _links: Record<string, Link | Link[]> = {};
    for (const [rel, link] of this.links) {
      _links[rel] = link;
    }

    const result: Record<string, unknown> = { ...this.data, _links };

    if (this.embedded.size > 0) {
      const _embedded: Record<string, HalDocument | HalDocument[]> = {};
      for (const [rel, resource] of this.embedded) {
        _embedded[rel] = resource;
      }
      result['_embedded'] = _embedded;
    }

    return result as T & HalDocument;
  }
}
