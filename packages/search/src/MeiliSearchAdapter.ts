import type { SearchPort } from './SearchPort';
import type {
  FacetFilter,
  FacetResult,
  IndexOptions,
  SearchDocument,
  SearchQuery,
  SearchResult,
  SuggestResult,
} from './SearchTypes';

// ---------------------------------------------------------------------------
// Client interface  (mirrors meilisearch npm package shapes)
// ---------------------------------------------------------------------------

export interface MeiliSearchOptions {
  readonly q?: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly filter?: string;
  readonly facets?: readonly string[];
  readonly sort?: readonly string[];
}

export interface MeiliDistribution {
  readonly [value: string]: number;
}

export interface MeiliSearchResponse {
  readonly hits: readonly Record<string, unknown>[];
  readonly estimatedTotalHits: number;
  readonly facetDistribution?: Record<string, MeiliDistribution>;
  readonly processingTimeMs?: number;
}

export interface MeiliTask {
  readonly taskUid: number;
  readonly status?: string;
}

export interface MeiliIndexOptions {
  readonly primaryKey?: string;
}

/** Per-index API surface. */
export interface MeiliIndexLike {
  search(query: string, options?: MeiliSearchOptions): Promise<MeiliSearchResponse>;
  addDocuments(docs: readonly Record<string, unknown>[]): Promise<MeiliTask>;
  deleteDocument(id: string): Promise<MeiliTask>;
  updateSearchableAttributes(fields: readonly string[]): Promise<MeiliTask>;
  updateFilterableAttributes(fields: readonly string[]): Promise<MeiliTask>;
  updateSortableAttributes(fields: readonly string[]): Promise<MeiliTask>;
}

/** Top-level MeiliSearch client. Mirrors the `meilisearch` npm package. */
export interface MeiliClientLike {
  index(uid: string): MeiliIndexLike;
  createIndex(uid: string, options?: MeiliIndexOptions): Promise<MeiliTask>;
  deleteIndex(uid: string): Promise<MeiliTask>;
  health(): Promise<{ status: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMeiliFilter(filters: readonly FacetFilter[]): string | undefined {
  if (filters.length === 0) return undefined;
  return filters.map((f) => `${f.field} = "${f.value}"`).join(' AND ');
}

function buildMeiliSort(
  sort: readonly { readonly field: string; readonly order: 'asc' | 'desc' }[],
): readonly string[] {
  return sort.map((s) => `${s.field}:${s.order}`);
}

function parseMeiliFacets(
  distribution: Record<string, MeiliDistribution>,
  facetFields: readonly string[],
): readonly FacetResult[] {
  return facetFields.map((field) => {
    const dist = distribution[field] ?? {};
    const buckets = Object.entries(dist).map(([value, count]) => ({ value, count }));
    return { field, buckets };
  });
}

function meiliHitToDocument(hit: Record<string, unknown>): SearchDocument {
  const id = typeof hit['id'] === 'string' ? hit['id'] : '';
  return { id, ...hit };
}

function buildMeiliSearchOptions(
  query: SearchQuery,
  page: number,
  hitsPerPage: number,
): MeiliSearchOptions {
  const filter = buildMeiliFilter(query.filters ?? []);
  const sort = buildMeiliSort(query.sort ?? []);
  return {
    limit: hitsPerPage,
    offset: page * hitsPerPage,
    ...(filter === undefined ? {} : { filter }),
    ...(query.facets === undefined ? {} : { facets: query.facets }),
    ...(sort.length > 0 ? { sort } : {}),
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Search adapter backed by MeiliSearch.
 *
 * Inject a client implementing {@link MeiliClientLike}
 * (e.g. `new MeiliSearch({ host: 'http://localhost:7700' })`).
 *
 * @example
 * ```ts
 * const search = new MeiliSearchAdapter(meiliClient);
 * await search.createIndex('movies', { primaryKey: 'id' });
 * await search.indexDocument('movies', { id: '1', title: 'Inception', genre: 'sci-fi' });
 * const result = await search.search('movies', { q: 'inception', facets: ['genre'] });
 * ```
 */
export class MeiliSearchAdapter implements SearchPort {
  constructor(private readonly client: MeiliClientLike) {}

  async indexDocument(index: string, doc: SearchDocument): Promise<void> {
    const record: Record<string, unknown> = { ...doc };
    await this.client.index(index).addDocuments([record]);
  }

  async bulkIndexDocuments(index: string, docs: readonly SearchDocument[]): Promise<void> {
    const records = docs.map((d) => ({ ...d }) as Record<string, unknown>);
    await this.client.index(index).addDocuments(records);
  }

  async deleteDocument(index: string, id: string): Promise<void> {
    await this.client.index(index).deleteDocument(id);
  }

  async search(index: string, query: SearchQuery): Promise<SearchResult> {
    const page = query.page ?? 0;
    const hitsPerPage = query.hitsPerPage ?? 20;
    const options = buildMeiliSearchOptions(query, page, hitsPerPage);

    const response = await this.client.index(index).search(query.q, options);
    const facets =
      query.facets === undefined || response.facetDistribution === undefined
        ? undefined
        : parseMeiliFacets(response.facetDistribution, query.facets);

    const result: SearchResult = {
      hits: response.hits.map(meiliHitToDocument),
      total: response.estimatedTotalHits,
      page,
      hitsPerPage,
      ...(response.processingTimeMs === undefined
        ? {}
        : { timeTakenMs: response.processingTimeMs }),
      ...(facets === undefined ? {} : { facets }),
    };
    return result;
  }

  async suggest(index: string, prefix: string, field: string): Promise<SuggestResult> {
    const response = await this.client.index(index).search(prefix, { limit: 10 });
    const seen = new Set<string>();
    for (const hit of response.hits) {
      const val = hit[field];
      if (typeof val === 'string' && val.toLowerCase().startsWith(prefix.toLowerCase())) {
        seen.add(val);
      }
    }
    return { suggestions: [...seen].sort((a, b) => a.localeCompare(b)) };
  }

  async createIndex(index: string, options?: IndexOptions): Promise<void> {
    await this.client.createIndex(index, {
      ...(options?.primaryKey === undefined ? {} : { primaryKey: options.primaryKey }),
    });
    const idx = this.client.index(index);
    if (options?.searchableFields !== undefined) {
      await idx.updateSearchableAttributes(options.searchableFields);
    }
    if (options?.filterableFields !== undefined) {
      await idx.updateFilterableAttributes(options.filterableFields);
    }
    if (options?.sortableFields !== undefined) {
      await idx.updateSortableAttributes(options.sortableFields);
    }
  }

  async deleteIndex(index: string): Promise<void> {
    await this.client.deleteIndex(index);
  }

  async checkHealth(): Promise<boolean> {
    try {
      const { status } = await this.client.health();
      return status === 'available';
    } catch {
      return false;
    }
  }
}
