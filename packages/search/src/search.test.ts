import { beforeEach, describe, expect, it } from 'vitest';
import { AlgoliaAdapter } from './AlgoliaAdapter';
import type {
  AlgoliaClientLike,
  AlgoliaHit,
  AlgoliaIndexLike,
  AlgoliaSearchResponse,
} from './AlgoliaAdapter';
import { ElasticsearchAdapter } from './ElasticsearchAdapter';
import type { EsClientLike, EsSearchResponse } from './ElasticsearchAdapter';
import { InMemorySearchAdapter } from './InMemorySearchAdapter';
import { MeiliSearchAdapter } from './MeiliSearchAdapter';
import type { MeiliClientLike, MeiliIndexLike, MeiliSearchResponse } from './MeiliSearchAdapter';
import {
  SearchDocumentNotFoundError,
  SearchIndexingError,
  SearchIndexNotFoundError,
  SearchQueryError,
  SearchUnavailableError,
} from './SearchErrors';

// ---------------------------------------------------------------------------
// SearchErrors
// ---------------------------------------------------------------------------

describe('SearchErrors', () => {
  it('SearchIndexNotFoundError has correct name and message', () => {
    const err = new SearchIndexNotFoundError('products');
    expect(err.name).toBe('SearchIndexNotFoundError');
    expect(err.message).toContain('products');
    expect(err).toBeInstanceOf(Error);
  });

  it('SearchIndexingError captures cause', () => {
    const cause = new Error('disk full');
    const err = new SearchIndexingError('logs', cause);
    expect(err.name).toBe('SearchIndexingError');
    expect(err.cause).toBe(cause);
  });

  it('SearchQueryError includes message and cause', () => {
    const cause = new Error('bad syntax');
    const err = new SearchQueryError('unmatched bracket', cause);
    expect(err.name).toBe('SearchQueryError');
    expect(err.message).toContain('unmatched bracket');
    expect(err.cause).toBe(cause);
  });

  it('SearchDocumentNotFoundError contains index and id', () => {
    const err = new SearchDocumentNotFoundError('orders', 'ord-42');
    expect(err.name).toBe('SearchDocumentNotFoundError');
    expect(err.message).toContain('orders');
    expect(err.message).toContain('ord-42');
  });

  it('SearchUnavailableError captures optional cause', () => {
    const cause = new Error('timeout');
    const err = new SearchUnavailableError(cause);
    expect(err.name).toBe('SearchUnavailableError');
    expect(err.cause).toBe(cause);
  });
});

// ---------------------------------------------------------------------------
// InMemorySearchAdapter
// ---------------------------------------------------------------------------

describe('InMemorySearchAdapter', () => {
  let adapter: InMemorySearchAdapter;

  beforeEach(async () => {
    adapter = new InMemorySearchAdapter();
    await adapter.createIndex('items');
  });

  it('createIndex is idempotent', async () => {
    await adapter.createIndex('items'); // second call should not throw
    expect(adapter.getDocumentCount('items')).toBe(0);
  });

  it('indexDocument stores a document', async () => {
    await adapter.indexDocument('items', { id: '1', name: 'Hammer' });
    expect(adapter.getDocumentCount('items')).toBe(1);
  });

  it('indexDocument replaces document with same id', async () => {
    await adapter.indexDocument('items', { id: '1', name: 'Hammer' });
    await adapter.indexDocument('items', { id: '1', name: 'Drill' });
    expect(adapter.getDocumentCount('items')).toBe(1);
    const result = await adapter.search('items', { q: '' });
    expect(result.hits[0]?.['name']).toBe('Drill');
  });

  it('indexDocument rejects for unknown index', async () => {
    await expect(adapter.indexDocument('ghost', { id: '1', name: 'X' })).rejects.toBeInstanceOf(
      SearchIndexNotFoundError,
    );
  });

  it('bulkIndexDocuments stores multiple documents', async () => {
    await adapter.bulkIndexDocuments('items', [
      { id: '1', name: 'Hammer' },
      { id: '2', name: 'Saw' },
      { id: '3', name: 'Drill' },
    ]);
    expect(adapter.getDocumentCount('items')).toBe(3);
  });

  it('deleteDocument removes a document', async () => {
    await adapter.indexDocument('items', { id: '1', name: 'Hammer' });
    await adapter.deleteDocument('items', '1');
    expect(adapter.getDocumentCount('items')).toBe(0);
  });

  it('deleteIndex removes the index entirely', async () => {
    await adapter.deleteIndex('items');
    await expect(adapter.search('items', { q: '' })).rejects.toBeInstanceOf(
      SearchIndexNotFoundError,
    );
  });

  it('search returns all documents when q is empty', async () => {
    await adapter.bulkIndexDocuments('items', [
      { id: '1', name: 'Hammer' },
      { id: '2', name: 'Saw' },
    ]);
    const result = await adapter.search('items', { q: '' });
    expect(result.total).toBe(2);
    expect(result.hits).toHaveLength(2);
  });

  it('search returns all documents when q is wildcard', async () => {
    await adapter.bulkIndexDocuments('items', [
      { id: '1', name: 'Hammer' },
      { id: '2', name: 'Saw' },
    ]);
    const result = await adapter.search('items', { q: '*' });
    expect(result.total).toBe(2);
  });

  it('search filters by substring match', async () => {
    await adapter.bulkIndexDocuments('items', [
      { id: '1', name: 'Hammer' },
      { id: '2', name: 'Saw' },
      { id: '3', name: 'Circular Saw' },
    ]);
    const result = await adapter.search('items', { q: 'saw' });
    expect(result.total).toBe(2);
  });

  it('search is case-insensitive', async () => {
    await adapter.indexDocument('items', { id: '1', name: 'HAMMER' });
    const result = await adapter.search('items', { q: 'hammer' });
    expect(result.total).toBe(1);
  });

  it('search filters by facet filter', async () => {
    await adapter.bulkIndexDocuments('items', [
      { id: '1', name: 'Hammer', category: 'hand-tools' },
      { id: '2', name: 'Saw', category: 'hand-tools' },
      { id: '3', name: 'Drill', category: 'power-tools' },
    ]);
    const result = await adapter.search('items', {
      q: '',
      filters: [{ field: 'category', value: 'hand-tools' }],
    });
    expect(result.total).toBe(2);
  });

  it('search returns facet counts', async () => {
    await adapter.bulkIndexDocuments('items', [
      { id: '1', name: 'Hammer', category: 'hand-tools' },
      { id: '2', name: 'Saw', category: 'hand-tools' },
      { id: '3', name: 'Drill', category: 'power-tools' },
    ]);
    const result = await adapter.search('items', { q: '', facets: ['category'] });
    expect(result.facets).toHaveLength(1);
    const catFacet = result.facets?.[0];
    expect(catFacet?.field).toBe('category');
    expect(catFacet?.buckets).toHaveLength(2);
  });

  it('search respects pagination (page + hitsPerPage)', async () => {
    await adapter.bulkIndexDocuments('items', [
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
      { id: '3', name: 'C' },
      { id: '4', name: 'D' },
      { id: '5', name: 'E' },
    ]);
    const page0 = await adapter.search('items', { q: '', hitsPerPage: 2, page: 0 });
    const page1 = await adapter.search('items', { q: '', hitsPerPage: 2, page: 1 });
    expect(page0.hits).toHaveLength(2);
    expect(page1.hits).toHaveLength(2);
    expect(page0.total).toBe(5);
  });

  it('search sorts ascending by field', async () => {
    await adapter.bulkIndexDocuments('items', [
      { id: '1', name: 'Zulu' },
      { id: '2', name: 'Alpha' },
      { id: '3', name: 'Mike' },
    ]);
    const result = await adapter.search('items', {
      q: '',
      sort: [{ field: 'name', order: 'asc' }],
    });
    expect(result.hits[0]?.['name']).toBe('Alpha');
    expect(result.hits[2]?.['name']).toBe('Zulu');
  });

  it('search rejects for unknown index', async () => {
    await expect(adapter.search('missing', { q: 'x' })).rejects.toBeInstanceOf(
      SearchIndexNotFoundError,
    );
  });

  it('suggest returns prefix-matched field values', async () => {
    await adapter.bulkIndexDocuments('items', [
      { id: '1', name: 'Hammer' },
      { id: '2', name: 'Hand Saw' },
      { id: '3', name: 'Drill' },
    ]);
    const result = await adapter.suggest('items', 'ha', 'name');
    expect(result.suggestions).toContain('Hammer');
    expect(result.suggestions).toContain('Hand Saw');
    expect(result.suggestions).not.toContain('Drill');
  });

  it('checkHealth always returns true', async () => {
    expect(await adapter.checkHealth()).toBe(true);
  });

  it('clear resets all indices and documents', async () => {
    await adapter.indexDocument('items', { id: '1', name: 'X' });
    adapter.clear();
    await expect(adapter.search('items', { q: '' })).rejects.toBeInstanceOf(
      SearchIndexNotFoundError,
    );
  });
});

// ---------------------------------------------------------------------------
// ElasticsearchAdapter
// ---------------------------------------------------------------------------

function buildEsResponse(overrides?: Partial<EsSearchResponse>): EsSearchResponse {
  const base: EsSearchResponse = {
    hits: { total: { value: 0 }, hits: [] },
    took: 2,
  };
  return { ...base, ...overrides };
}

function buildEsClient(
  overrides?: Partial<Omit<EsClientLike, 'indices'>> & {
    indicesOverrides?: Partial<EsClientLike['indices']>;
  },
): EsClientLike {
  return {
    index: overrides?.index ?? (() => Promise.resolve()),
    delete: overrides?.delete ?? (() => Promise.resolve()),
    search: overrides?.search ?? (() => Promise.resolve(buildEsResponse())),
    bulk: overrides?.bulk ?? (() => Promise.resolve()),
    ping: overrides?.ping ?? (() => Promise.resolve()),
    indices: {
      create: overrides?.indicesOverrides?.create ?? (() => Promise.resolve()),
      delete: overrides?.indicesOverrides?.delete ?? (() => Promise.resolve()),
      exists: overrides?.indicesOverrides?.exists ?? (() => Promise.resolve(false)),
    },
  };
}

describe('ElasticsearchAdapter', () => {
  it('indexDocument calls client.index with correct params', async () => {
    let capturedIndex = '';
    let capturedId = '';
    const client = buildEsClient({
      index: (p) => {
        capturedIndex = p.index;
        capturedId = p.id;
        return Promise.resolve();
      },
    });
    await new ElasticsearchAdapter(client).indexDocument('products', { id: 'p1', name: 'Widget' });
    expect(capturedIndex).toBe('products');
    expect(capturedId).toBe('p1');
  });

  it('deleteDocument calls client.delete', async () => {
    let deleteCalled = false;
    const client = buildEsClient({
      delete: () => {
        deleteCalled = true;
        return Promise.resolve();
      },
    });
    await new ElasticsearchAdapter(client).deleteDocument('products', 'p1');
    expect(deleteCalled).toBe(true);
  });

  it('search maps ES hits to SearchDocuments', async () => {
    const client = buildEsClient({
      search: () =>
        Promise.resolve(
          buildEsResponse({
            hits: {
              total: { value: 1 },
              hits: [{ _id: 'p1', _source: { name: 'Widget', price: 9 } }],
            },
          }),
        ),
    });
    const result = await new ElasticsearchAdapter(client).search('products', { q: 'widget' });
    expect(result.total).toBe(1);
    expect(result.hits[0]?.id).toBe('p1');
    expect(result.hits[0]?.['name']).toBe('Widget');
  });

  it('search includes facets when aggregations are returned', async () => {
    const client = buildEsClient({
      search: () =>
        Promise.resolve(
          buildEsResponse({
            hits: { total: { value: 2 }, hits: [] },
            aggregations: {
              category: { buckets: [{ key: 'tools', doc_count: 2 }] },
            },
          }),
        ),
    });
    const result = await new ElasticsearchAdapter(client).search('products', {
      q: '',
      facets: ['category'],
    });
    expect(result.facets).toHaveLength(1);
    expect(result.facets?.[0]?.buckets[0]?.value).toBe('tools');
  });

  it('checkHealth returns true when ping succeeds', async () => {
    const adapter = new ElasticsearchAdapter(buildEsClient());
    expect(await adapter.checkHealth()).toBe(true);
  });

  it('checkHealth returns false when ping throws', async () => {
    const client = buildEsClient({ ping: () => Promise.reject(new Error('refused')) });
    expect(await new ElasticsearchAdapter(client).checkHealth()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MeiliSearchAdapter
// ---------------------------------------------------------------------------

function buildMeiliResponse(overrides?: Partial<MeiliSearchResponse>): MeiliSearchResponse {
  return {
    hits: [],
    estimatedTotalHits: 0,
    processingTimeMs: 1,
    ...overrides,
  };
}

function buildMeiliIndex(searchResponse?: MeiliSearchResponse): MeiliIndexLike {
  return {
    search: () => Promise.resolve(searchResponse ?? buildMeiliResponse()),
    addDocuments: () => Promise.resolve({ taskUid: 1 }),
    deleteDocument: () => Promise.resolve({ taskUid: 2 }),
    updateSearchableAttributes: () => Promise.resolve({ taskUid: 3 }),
    updateFilterableAttributes: () => Promise.resolve({ taskUid: 4 }),
    updateSortableAttributes: () => Promise.resolve({ taskUid: 5 }),
  };
}

function buildMeiliClient(indexOverride?: MeiliIndexLike): MeiliClientLike {
  return {
    index: () => indexOverride ?? buildMeiliIndex(),
    createIndex: () => Promise.resolve({ taskUid: 10 }),
    deleteIndex: () => Promise.resolve({ taskUid: 11 }),
    health: () => Promise.resolve({ status: 'available' }),
  };
}

describe('MeiliSearchAdapter', () => {
  it('indexDocument calls addDocuments on the index', async () => {
    let addCalled = false;
    const idx = buildMeiliIndex();
    const patchedIdx: MeiliIndexLike = {
      ...idx,
      addDocuments: (d) => {
        addCalled = true;
        return idx.addDocuments(d);
      },
    };
    const adapter = new MeiliSearchAdapter(buildMeiliClient(patchedIdx));
    await adapter.indexDocument('movies', { id: 'm1', title: 'Inception' });
    expect(addCalled).toBe(true);
  });

  it('search maps hits to SearchDocuments', async () => {
    const response = buildMeiliResponse({
      hits: [{ id: 'm1', title: 'Inception' }],
      estimatedTotalHits: 1,
    });
    const adapter = new MeiliSearchAdapter(buildMeiliClient(buildMeiliIndex(response)));
    const result = await adapter.search('movies', { q: 'inception' });
    expect(result.total).toBe(1);
    expect(result.hits[0]?.id).toBe('m1');
    expect(result.hits[0]?.['title']).toBe('Inception');
  });

  it('search includes facets when facetDistribution is present', async () => {
    const response = buildMeiliResponse({
      hits: [],
      estimatedTotalHits: 2,
      facetDistribution: { genre: { 'sci-fi': 2 } },
    });
    const adapter = new MeiliSearchAdapter(buildMeiliClient(buildMeiliIndex(response)));
    const result = await adapter.search('movies', { q: '', facets: ['genre'] });
    expect(result.facets).toHaveLength(1);
    expect(result.facets?.[0]?.buckets[0]?.value).toBe('sci-fi');
  });

  it('checkHealth returns true when status is available', async () => {
    const adapter = new MeiliSearchAdapter(buildMeiliClient());
    expect(await adapter.checkHealth()).toBe(true);
  });

  it('checkHealth returns false when health() throws', async () => {
    const client: MeiliClientLike = {
      index: () => buildMeiliIndex(),
      createIndex: () => Promise.resolve({ taskUid: 1 }),
      deleteIndex: () => Promise.resolve({ taskUid: 2 }),
      health: () => Promise.reject(new Error('timeout')),
    };
    expect(await new MeiliSearchAdapter(client).checkHealth()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AlgoliaAdapter
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AlgoliaAdapter
// ---------------------------------------------------------------------------

function buildAlgoliaResponse(overrides?: Partial<AlgoliaSearchResponse>): AlgoliaSearchResponse {
  return {
    hits: [],
    nbHits: 0,
    page: 0,
    hitsPerPage: 20,
    processingTimeMS: 1,
    ...overrides,
  };
}

function buildAlgoliaIndex(searchResponse?: AlgoliaSearchResponse): AlgoliaIndexLike {
  return {
    search: () => Promise.resolve(searchResponse ?? buildAlgoliaResponse()),
    saveObject: (obj) => Promise.resolve({ objectID: obj.objectID }),
    saveObjects: (objs) => Promise.resolve({ objectIDs: objs.map((o) => o.objectID) }),
    deleteObject: () => Promise.resolve(),
    setSettings: () => Promise.resolve(),
    clearObjects: () => Promise.resolve(),
  };
}

function buildAlgoliaClient(indexOverride?: AlgoliaIndexLike): AlgoliaClientLike {
  return {
    initIndex: () => indexOverride ?? buildAlgoliaIndex(),
    listIndices: () => Promise.resolve({ items: [] }),
  };
}

describe('AlgoliaAdapter', () => {
  it('indexDocument calls saveObject with correct objectID', async () => {
    let capturedId = '';
    const idx = buildAlgoliaIndex();
    const patched: AlgoliaIndexLike = {
      ...idx,
      saveObject: (obj) => {
        capturedId = obj.objectID;
        return idx.saveObject(obj);
      },
    };
    const adapter = new AlgoliaAdapter(buildAlgoliaClient(patched));
    await adapter.indexDocument('articles', { id: 'a1', title: 'Hello' });
    expect(capturedId).toBe('a1');
  });

  it('search maps Algolia hits to SearchDocuments', async () => {
    const hits: AlgoliaHit[] = [{ objectID: 'a1', title: 'Hello world', lang: 'en' }];
    const response = buildAlgoliaResponse({ hits, nbHits: 1 });
    const adapter = new AlgoliaAdapter(buildAlgoliaClient(buildAlgoliaIndex(response)));
    const result = await adapter.search('articles', { q: 'hello' });
    expect(result.total).toBe(1);
    expect(result.hits[0]?.id).toBe('a1');
    expect(result.hits[0]?.['title']).toBe('Hello world');
  });

  it('search includes facets when present in response', async () => {
    const response = buildAlgoliaResponse({
      nbHits: 3,
      facets: { lang: { en: 2, fr: 1 } },
    });
    const adapter = new AlgoliaAdapter(buildAlgoliaClient(buildAlgoliaIndex(response)));
    const result = await adapter.search('articles', { q: '', facets: ['lang'] });
    expect(result.facets).toHaveLength(1);
    expect(result.facets?.[0]?.buckets).toHaveLength(2);
  });

  it('checkHealth returns true when listIndices succeeds', async () => {
    expect(await new AlgoliaAdapter(buildAlgoliaClient()).checkHealth()).toBe(true);
  });

  it('checkHealth returns false when listIndices throws', async () => {
    const client: AlgoliaClientLike = {
      initIndex: () => buildAlgoliaIndex(),
      listIndices: () => Promise.reject(new Error('forbidden')),
    };
    expect(await new AlgoliaAdapter(client).checkHealth()).toBe(false);
  });
});
