import type { Link } from './Link';

/**
 * A JSON:API relationship value.
 * https://jsonapi.org/format/#document-resource-object-relationships
 */
export interface JsonApiRelationship {
  readonly data: JsonApiIdentifier | JsonApiIdentifier[];
}

/** A minimal resource identifier object (type + id). */
export interface JsonApiIdentifier {
  readonly id: string;
  readonly type: string;
}

/**
 * A JSON:API resource object.
 * https://jsonapi.org/format/#document-resource-objects
 */
export interface JsonApiResourceObject<T> {
  readonly id: string;
  readonly type: string;
  readonly attributes?: T;
  readonly relationships?: Record<string, JsonApiRelationship>;
  readonly links?: Record<string, Link>;
}

/**
 * A JSON:API top-level document.
 * https://jsonapi.org/format/#document-top-level
 */
export interface JsonApiDocument<T> {
  readonly data: JsonApiResourceObject<T> | JsonApiResourceObject<T>[];
  readonly links?: Record<string, Link>;
  readonly meta?: Record<string, unknown>;
}

/**
 * Fluent builder for creating a {@link JsonApiDocument}.
 *
 * @example
 * ```ts
 * const doc = new JsonApiBuilder('users', '1', { name: 'Alice' })
 *   .addLink('self', { href: '/users/1', rel: 'self' })
 *   .build();
 * ```
 */
export class JsonApiBuilder<T extends object> {
  private readonly _type: string;
  private readonly _id: string;
  private readonly _attributes: T;
  private readonly _relationships: Map<string, JsonApiRelationship>;
  private readonly _links: Map<string, Link>;
  private _meta?: Record<string, unknown>;

  constructor(type: string, id: string, attributes: T) {
    this._type = type;
    this._id = id;
    this._attributes = attributes;
    this._relationships = new Map<string, JsonApiRelationship>();
    this._links = new Map<string, Link>();
  }

  addRelationship(rel: string, relationship: JsonApiRelationship): this {
    this._relationships.set(rel, relationship);
    return this;
  }

  addLink(rel: string, link: Link): this {
    this._links.set(rel, link);
    return this;
  }

  withMeta(meta: Record<string, unknown>): this {
    this._meta = meta;
    return this;
  }

  build(): JsonApiDocument<T> {
    const resource: Record<string, unknown> = {
      id: this._id,
      type: this._type,
      attributes: this._attributes,
    };

    if (this._relationships.size > 0) {
      const relationships: Record<string, JsonApiRelationship> = {};
      for (const [rel, value] of this._relationships) {
        relationships[rel] = value;
      }
      resource['relationships'] = relationships;
    }

    if (this._links.size > 0) {
      const links: Record<string, Link> = {};
      for (const [rel, link] of this._links) {
        links[rel] = link;
      }
      resource['links'] = links;
    }

    const document: Record<string, unknown> = {
      data: resource as unknown as JsonApiResourceObject<T>,
    };

    if (this._links.size > 0) {
      const topLinks: Record<string, Link> = {};
      for (const [rel, link] of this._links) {
        topLinks[rel] = link;
      }
      document['links'] = topLinks;
    }

    if (this._meta !== undefined) {
      document['meta'] = this._meta;
    }

    return document as unknown as JsonApiDocument<T>;
  }
}
