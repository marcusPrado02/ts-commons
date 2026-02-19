/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from 'vitest';
import type { Link } from '../hateoas/Link';
import { LinkBuilder } from '../hateoas/LinkBuilder';
import { HalResource } from '../hateoas/HalResource';
import type { HalDocument } from '../hateoas/HalResource';
import { JsonApiBuilder } from '../hateoas/JsonApiResource';

// ---------------------------------------------------------------------------
// Suite 1: Link interface shape
// ---------------------------------------------------------------------------

describe('Link interface', () => {
  it('accepts a minimal link with only href and rel', () => {
    const link: Link = { href: 'https://api.acme.com/users', rel: 'self' };
    expect(link.href).toBe('https://api.acme.com/users');
    expect(link.rel).toBe('self');
  });

  it('optional fields are absent when not provided', () => {
    const link: Link = { href: '/orders', rel: 'collection' };
    expect(link.method).toBeUndefined();
    expect(link.title).toBeUndefined();
    expect(link.type).toBeUndefined();
  });

  it('accepts a fully populated link', () => {
    const link: Link = {
      href: '/orders',
      rel: 'create',
      method: 'POST',
      title: 'Create order',
      type: 'application/json',
    };
    expect(link.method).toBe('POST');
    expect(link.title).toBe('Create order');
    expect(link.type).toBe('application/json');
  });
});

// ---------------------------------------------------------------------------
// Suite 2: LinkBuilder
// ---------------------------------------------------------------------------

describe('LinkBuilder', () => {
  it('static self() returns a link with rel="self"', () => {
    const link = LinkBuilder.self('https://api.acme.com/users/1');
    expect(link.href).toBe('https://api.acme.com/users/1');
    expect(link.rel).toBe('self');
  });

  it('static collection() returns a link with rel="collection"', () => {
    const link = LinkBuilder.collection('https://api.acme.com/users');
    expect(link.href).toBe('https://api.acme.com/users');
    expect(link.rel).toBe('collection');
  });

  it('static related() returns a link with the given rel', () => {
    const link = LinkBuilder.related('next', 'https://api.acme.com/users?page=2');
    expect(link.rel).toBe('next');
    expect(link.href).toBe('https://api.acme.com/users?page=2');
  });

  it('fluent chain withMethod().withTitle().withType() is chainable', () => {
    const builder = new LinkBuilder('/orders', 'create');
    const result = builder.withMethod('POST').withTitle('Create').withType('application/json');
    expect(result).toBe(builder);
  });

  it('build() includes optional fields set via fluent methods', () => {
    const link = new LinkBuilder('/orders', 'create')
      .withMethod('POST')
      .withTitle('New order')
      .withType('application/json')
      .build();

    expect(link.href).toBe('/orders');
    expect(link.rel).toBe('create');
    expect(link.method).toBe('POST');
    expect(link.title).toBe('New order');
    expect(link.type).toBe('application/json');
  });
});

// ---------------------------------------------------------------------------
// Suite 3: HalResource
// ---------------------------------------------------------------------------

describe('HalResource', () => {
  it('constructor automatically adds a self link', () => {
    const resource = new HalResource({ id: '1' }, 'https://api.acme.com/items/1');
    const doc = resource.toDocument();
    expect(doc._links?.['self']).toEqual({ href: 'https://api.acme.com/items/1', rel: 'self' });
  });

  it('toDocument() merges data properties with _links', () => {
    const resource = new HalResource({ id: '1', name: 'Alice' }, '/users/1');
    const doc = resource.toDocument();
    expect(((doc as unknown) as Record<string, unknown>)['id']).toBe('1');
    expect(((doc as unknown) as Record<string, unknown>)['name']).toBe('Alice');
    expect(doc._links).toBeDefined();
  });

  it('addLink() appends an extra relation to _links', () => {
    const collectionLink = LinkBuilder.collection('/users');
    const doc = new HalResource({ id: '1' }, '/users/1').addLink('users', collectionLink).toDocument();
    expect(doc._links?.['users']).toEqual(collectionLink);
  });

  it('embed() adds a single resource to _embedded', () => {
    const address: HalDocument = { _links: { self: { href: '/addresses/10', rel: 'self' } } };
    const doc = new HalResource({ id: '1' }, '/users/1').embed('address', address).toDocument();
    expect(doc._embedded?.['address']).toEqual(address);
  });

  it('embed() supports an array of embedded resources', () => {
    const orders: HalDocument[] = [
      { _links: { self: { href: '/orders/1', rel: 'self' } } },
      { _links: { self: { href: '/orders/2', rel: 'self' } } },
    ];
    const doc = new HalResource({ id: '1' }, '/users/1').embed('orders', orders).toDocument();
    expect(Array.isArray(doc._embedded?.['orders'])).toBe(true);
    expect((doc._embedded?.['orders'] as HalDocument[]).length).toBe(2);
  });

  it('multiple addLink() calls accumulate all relations', () => {
    const doc = new HalResource({ id: '1' }, '/users/1')
      .addLink('collection', LinkBuilder.collection('/users'))
      .addLink('next', LinkBuilder.related('next', '/users/2'))
      .toDocument();
    expect(Object.keys(doc._links ?? {})).toContain('self');
    expect(Object.keys(doc._links ?? {})).toContain('collection');
    expect(Object.keys(doc._links ?? {})).toContain('next');
  });
});

// ---------------------------------------------------------------------------
// Suite 4: JsonApiBuilder / JsonApiDocument
// ---------------------------------------------------------------------------

describe('JsonApiBuilder', () => {
  it('build() produces a document with id, type and attributes', () => {
    const doc = new JsonApiBuilder('users', '1', { name: 'Alice' }).build();
    const resource = (doc.data as unknown) as Record<string, unknown>;
    expect(resource['id']).toBe('1');
    expect(resource['type']).toBe('users');
    expect(resource['attributes']).toEqual({ name: 'Alice' });
  });

  it('addRelationship() adds to the relationships map', () => {
    const doc = new JsonApiBuilder('orders', '99', { total: 50 })
      .addRelationship('customer', { data: { id: '1', type: 'users' } })
      .build();
    const resource = (doc.data as unknown) as Record<string, unknown>;
    expect(resource['relationships']).toHaveProperty('customer');
  });

  it('addLink() includes the link in the document links', () => {
    const link: Link = { href: '/orders/99', rel: 'self' };
    const doc = new JsonApiBuilder('orders', '99', { total: 50 }).addLink('self', link).build();
    expect(doc.links).toHaveProperty('self');
    expect(doc.links?.['self']).toEqual(link);
  });

  it('withMeta() attaches metadata to the document', () => {
    const doc = new JsonApiBuilder('users', '1', { name: 'Alice' })
      .withMeta({ requestId: 'abc-123' })
      .build();
    expect(doc.meta).toEqual({ requestId: 'abc-123' });
  });

  it('build() omits optional sections when nothing is added', () => {
    const doc = new JsonApiBuilder('users', '1', { name: 'Bob' }).build();
    expect(doc.meta).toBeUndefined();
    const resource = (doc.data as unknown) as Record<string, unknown>;
    expect(resource['relationships']).toBeUndefined();
  });
});
