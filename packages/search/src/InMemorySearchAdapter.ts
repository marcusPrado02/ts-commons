import { SearchIndexNotFoundError } from './SearchErrors';
import type { SearchPort } from './SearchPort';
import type {
  FacetFilter,
  FacetResult,
  IndexOptions,
  SearchDocument,
  SearchQuery,
  SearchResult,
  SortField,
  SuggestResult,
} from './SearchTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filterByQuery(docs: readonly SearchDocument[], q: string): readonly SearchDocument[] {
  if (q === '' || q === '*') return docs;
  const lower = q.toLowerCase();
  return docs.filter((doc) =>
    Object.values(doc).some((val) => typeof val === 'string' && val.toLowerCase().includes(lower)),
  );
}

function applyFilters(
  docs: readonly SearchDocument[],
  filters: readonly FacetFilter[],
): readonly SearchDocument[] {
  if (filters.length === 0) return docs;
  return docs.filter((doc) => filters.every((f) => doc[f.field] === f.value));
}

function computeFacets(
  docs: readonly SearchDocument[],
  facetFields: readonly string[],
): readonly FacetResult[] {
  return facetFields.map((field) => {
    const counts = new Map<string, number>();
    for (const doc of docs) {
      const val = doc[field];
      if (typeof val === 'string') counts.set(val, (counts.get(val) ?? 0) + 1);
    }
    return {
      field,
      buckets: [...counts.entries()].map(([value, count]) => ({ value, count })),
    };
  });
}

function compareByField(
  a: SearchDocument,
  b: SearchDocument,
  field: string,
  order: 'asc' | 'desc',
): number {
  const va = a[field];
  const vb = b[field];
  const sa = typeof va === 'string' ? va : typeof va === 'number' ? String(va) : '';
  const sb = typeof vb === 'string' ? vb : typeof vb === 'number' ? String(vb) : '';
  return order === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
}

function applySort(
  docs: readonly SearchDocument[],
  sort: readonly SortField[],
): readonly SearchDocument[] {
  if (sort.length === 0) return docs;
  return [...docs].sort((a, b) => {
    for (const clause of sort) {
      const cmp = compareByField(a, b, clause.field, clause.order);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

function paginate(
  docs: readonly SearchDocument[],
  page: number,
  hitsPerPage: number,
): readonly SearchDocument[] {
  return docs.slice(page * hitsPerPage, (page + 1) * hitsPerPage);
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * In-memory search adapter for testing.
 *
 * Supports full-text search (substring match), facet filtering, facet counts,
 * multi-field sorting, prefix-based suggestions, and pagination.
 *
 * Call {@link clear} in `beforeEach` hooks to reset state between tests.
 *
 * @example
 * ```ts
 * const search = new InMemorySearchAdapter();
 * await search.createIndex('products');
 * await search.indexDocument('products', { id: '1', name: 'Widget', category: 'tools' });
 * const result = await search.search('products', { q: 'widget', facets: ['category'] });
 * ```
 */
export class InMemorySearchAdapter implements SearchPort {
  private readonly indices = new Map<string, Map<string, SearchDocument>>();

  createIndex(_index: string, _options?: IndexOptions): Promise<void> {
    if (!this.indices.has(_index)) this.indices.set(_index, new Map());
    return Promise.resolve();
  }

  deleteIndex(index: string): Promise<void> {
    this.indices.delete(index);
    return Promise.resolve();
  }

  indexDocument(index: string, doc: SearchDocument): Promise<void> {
    const store = this.indices.get(index);
    if (store === undefined) return Promise.reject(new SearchIndexNotFoundError(index));
    store.set(doc.id, doc);
    return Promise.resolve();
  }

  bulkIndexDocuments(index: string, docs: readonly SearchDocument[]): Promise<void> {
    const store = this.indices.get(index);
    if (store === undefined) return Promise.reject(new SearchIndexNotFoundError(index));
    for (const doc of docs) store.set(doc.id, doc);
    return Promise.resolve();
  }

  deleteDocument(index: string, id: string): Promise<void> {
    const store = this.indices.get(index);
    if (store === undefined) return Promise.reject(new SearchIndexNotFoundError(index));
    store.delete(id);
    return Promise.resolve();
  }

  search(index: string, query: SearchQuery): Promise<SearchResult> {
    const store = this.indices.get(index);
    if (store === undefined) return Promise.reject(new SearchIndexNotFoundError(index));
    const page = query.page ?? 0;
    const hitsPerPage = query.hitsPerPage ?? 20;

    const queried = filterByQuery([...store.values()], query.q);
    const filtered = applyFilters(queried, query.filters ?? []);
    const facets = query.facets !== undefined ? computeFacets(filtered, query.facets) : undefined;
    const sorted = applySort(filtered, query.sort ?? []);

    const result: SearchResult = {
      hits: paginate(sorted, page, hitsPerPage),
      total: sorted.length,
      page,
      hitsPerPage,
      ...(facets !== undefined ? { facets } : {}),
    };
    return Promise.resolve(result);
  }

  suggest(index: string, prefix: string, field: string): Promise<SuggestResult> {
    const store = this.indices.get(index);
    if (store === undefined) return Promise.reject(new SearchIndexNotFoundError(index));
    const lower = prefix.toLowerCase();
    const seen = new Set<string>();
    for (const doc of store.values()) {
      const val = doc[field];
      if (typeof val === 'string' && val.toLowerCase().startsWith(lower)) seen.add(val);
    }
    return Promise.resolve({ suggestions: [...seen].sort() });
  }

  checkHealth(): Promise<boolean> {
    return Promise.resolve(true);
  }

  /** Remove all indices and documents. */
  clear(): void {
    this.indices.clear();
  }

  /** Return the number of documents in an index or `0` for unknown indices. */
  getDocumentCount(index: string): number {
    return this.indices.get(index)?.size ?? 0;
  }
}
