import type { SearchPort } from './SearchPort';
import type {
  FacetResult,
  IndexOptions,
  SearchDocument,
  SearchQuery,
  SearchResult,
  SuggestResult,
} from './SearchTypes';

// ---------------------------------------------------------------------------
// Client interface  (mirrors algoliasearch v4 shapes)
// ---------------------------------------------------------------------------

export interface AlgoliaSearchOptions {
  readonly query?: string;
  readonly page?: number;
  readonly hitsPerPage?: number;
  readonly filters?: string;
  readonly facets?: readonly string[];
  readonly attributesToRetrieve?: readonly string[];
}

export interface AlgoliaHit {
  readonly objectID: string;
  readonly [key: string]: unknown;
}

export interface AlgoliaFacetDistribution {
  readonly [value: string]: number;
}

export interface AlgoliaSearchResponse {
  readonly hits: readonly AlgoliaHit[];
  readonly nbHits: number;
  readonly page: number;
  readonly hitsPerPage: number;
  readonly facets?: Record<string, AlgoliaFacetDistribution>;
  readonly processingTimeMS?: number;
}

export interface AlgoliaIndexSettings {
  readonly searchableAttributes?: readonly string[];
  readonly attributesForFaceting?: readonly string[];
  readonly customRanking?: readonly string[];
}

/** Per-index Algolia API surface. */
export interface AlgoliaIndexLike {
  search(query: string, options?: AlgoliaSearchOptions): Promise<AlgoliaSearchResponse>;
  saveObject(
    object: { readonly objectID: string } & Record<string, unknown>,
  ): Promise<{ readonly objectID: string }>;
  saveObjects(
    objects: readonly ({ readonly objectID: string } & Record<string, unknown>)[],
  ): Promise<{ readonly objectIDs: readonly string[] }>;
  deleteObject(objectID: string): Promise<void>;
  setSettings(settings: AlgoliaIndexSettings): Promise<void>;
  clearObjects(): Promise<void>;
}

/** Top-level Algolia search client. Mirrors `algoliasearch`. */
export interface AlgoliaClientLike {
  initIndex(name: string): AlgoliaIndexLike;
  listIndices(): Promise<{ readonly items: readonly { readonly name: string }[] }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildAlgoliaFilters(
  filters: readonly { readonly field: string; readonly value: string }[],
): string | undefined {
  if (filters.length === 0) return undefined;
  return filters.map((f) => `${f.field}:"${f.value}"`).join(' AND ');
}

function parseAlgoliaFacets(
  facets: Record<string, AlgoliaFacetDistribution>,
  facetFields: readonly string[],
): readonly FacetResult[] {
  return facetFields.map((field) => {
    const dist = facets[field] ?? {};
    const buckets = Object.entries(dist).map(([value, count]) => ({ value, count }));
    return { field, buckets };
  });
}

function algoliaHitToDocument(hit: AlgoliaHit): SearchDocument {
  const { objectID, ...rest } = hit;
  return { id: objectID, ...rest };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Search adapter backed by Algolia.
 *
 * Inject a client implementing {@link AlgoliaClientLike}
 * (e.g. `algoliasearch(appId, apiKey)` from the `algoliasearch` npm package).
 *
 * @example
 * ```ts
 * const search = new AlgoliaAdapter(algoliaClient);
 * await search.createIndex('articles', { searchableFields: ['title', 'body'] });
 * await search.indexDocument('articles', { id: 'a1', title: 'Hello world', lang: 'en' });
 * const result = await search.search('articles', { q: 'hello', facets: ['lang'] });
 * ```
 */
export class AlgoliaAdapter implements SearchPort {
  constructor(private readonly client: AlgoliaClientLike) {}

  async indexDocument(index: string, doc: SearchDocument): Promise<void> {
    const { id, ...fields } = doc;
    await this.client.initIndex(index).saveObject({ objectID: String(id), ...fields });
  }

  async bulkIndexDocuments(index: string, docs: readonly SearchDocument[]): Promise<void> {
    const objects = docs.map((doc) => {
      const { id, ...fields } = doc;
      return { objectID: String(id), ...fields };
    });
    await this.client.initIndex(index).saveObjects(objects);
  }

  async deleteDocument(index: string, id: string): Promise<void> {
    await this.client.initIndex(index).deleteObject(id);
  }

  async search(index: string, query: SearchQuery): Promise<SearchResult> {
    const page = query.page ?? 0;
    const hitsPerPage = query.hitsPerPage ?? 20;
    const filters = buildAlgoliaFilters(query.filters ?? []);

    const options: AlgoliaSearchOptions = {
      page,
      hitsPerPage,
      ...(filters === undefined ? {} : { filters }),
      ...(query.facets === undefined ? {} : { facets: query.facets }),
    };

    const response = await this.client.initIndex(index).search(query.q, options);
    const facets =
      query.facets === undefined || response.facets === undefined
        ? undefined
        : parseAlgoliaFacets(response.facets, query.facets);

    const result: SearchResult = {
      hits: response.hits.map(algoliaHitToDocument),
      total: response.nbHits,
      page: response.page,
      hitsPerPage: response.hitsPerPage,
      ...(response.processingTimeMS === undefined
        ? {}
        : { timeTakenMs: response.processingTimeMS }),
      ...(facets === undefined ? {} : { facets }),
    };
    return result;
  }

  async suggest(index: string, prefix: string, field: string): Promise<SuggestResult> {
    const response = await this.client.initIndex(index).search(prefix, {
      hitsPerPage: 10,
      attributesToRetrieve: [field],
    });
    const seen = new Set<string>();
    for (const hit of response.hits) {
      const val = hit[field];
      if (typeof val === 'string') seen.add(val);
    }
    return { suggestions: [...seen].sort((a, b) => a.localeCompare(b)) };
  }

  async createIndex(index: string, options?: IndexOptions): Promise<void> {
    const settings: AlgoliaIndexSettings = {
      ...(options?.searchableFields === undefined
        ? {}
        : { searchableAttributes: options.searchableFields }),
      ...(options?.filterableFields === undefined
        ? {}
        : { attributesForFaceting: options.filterableFields }),
    };
    await this.client.initIndex(index).setSettings(settings);
  }

  async deleteIndex(index: string): Promise<void> {
    await this.client.initIndex(index).clearObjects();
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.client.listIndices();
      return true;
    } catch {
      return false;
    }
  }
}
