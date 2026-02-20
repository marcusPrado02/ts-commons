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
// Client interface  (mirrors @elastic/elasticsearch v8 shapes)
// ---------------------------------------------------------------------------

export interface EsHit {
  readonly _id: string;
  readonly _source: Record<string, unknown>;
}

export interface EsAggBucket {
  readonly key: string;
  readonly doc_count: number;
}

export interface EsAggResult {
  readonly buckets?: readonly EsAggBucket[];
}

export interface EsSearchResponse {
  readonly hits: {
    readonly total: { readonly value: number };
    readonly hits: readonly EsHit[];
  };
  readonly aggregations?: Record<string, EsAggResult>;
  readonly took?: number;
}

export interface EsSearchParams {
  readonly index: string;
  readonly body: Record<string, unknown>;
}

export interface EsIndexParams {
  readonly index: string;
  readonly id: string;
  readonly document: Record<string, unknown>;
}

/** Minimal Elasticsearch-compatible client. Mirrors `@elastic/elasticsearch` v8. */
export interface EsClientLike {
  index(params: EsIndexParams): Promise<void>;
  delete(params: { readonly index: string; readonly id: string }): Promise<void>;
  search(params: EsSearchParams): Promise<EsSearchResponse>;
  bulk(params: { readonly operations: readonly Record<string, unknown>[] }): Promise<void>;
  ping(): Promise<void>;
  indices: {
    create(params: {
      readonly index: string;
      readonly body?: Record<string, unknown>;
    }): Promise<void>;
    delete(params: { readonly index: string }): Promise<void>;
    exists(params: { readonly index: string }): Promise<boolean>;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEsQueryClause(q: string, fuzzy: boolean): Record<string, unknown> {
  if (q === '' || q === '*') return { match_all: {} };
  if (fuzzy) return { multi_match: { query: q, fields: ['*'], fuzziness: 'AUTO' } };
  return { multi_match: { query: q, fields: ['*'] } };
}

function buildEsFilterClause(filters: readonly FacetFilter[]): readonly Record<string, unknown>[] {
  return filters.map((f) => ({ term: { [f.field]: f.value } }));
}

function buildEsSort(sort: readonly SortField[]): readonly Record<string, unknown>[] {
  return sort.map((s) => ({ [s.field]: { order: s.order } }));
}

function buildEsAggs(facets: readonly string[]): Record<string, unknown> {
  const aggs: Record<string, unknown> = {};
  for (const field of facets) aggs[field] = { terms: { field, size: 100 } };
  return aggs;
}

function buildEsBody(query: SearchQuery): Record<string, unknown> {
  const page = query.page ?? 0;
  const hitsPerPage = query.hitsPerPage ?? 20;
  const filterClauses = buildEsFilterClause(query.filters ?? []);
  const queryClause = buildEsQueryClause(query.q, query.fuzzy === true);

  const boolQuery: Record<string, unknown> = { must: queryClause };
  if (filterClauses.length > 0) boolQuery['filter'] = filterClauses;

  const body: Record<string, unknown> = {
    query: { bool: boolQuery },
    from: page * hitsPerPage,
    size: hitsPerPage,
  };
  if ((query.sort ?? []).length > 0) body['sort'] = buildEsSort(query.sort ?? []);
  if (query.facets !== undefined && query.facets.length > 0) {
    body['aggs'] = buildEsAggs(query.facets);
  }
  return body;
}

function parseEsFacets(
  aggregations: Record<string, EsAggResult>,
  facetFields: readonly string[],
): readonly FacetResult[] {
  return facetFields.map((field) => {
    const agg = aggregations[field];
    const buckets = (agg?.buckets ?? []).map((b) => ({ value: b.key, count: b.doc_count }));
    return { field, buckets };
  });
}

function esHitToDocument(hit: EsHit): SearchDocument {
  return { id: hit._id, ...hit._source };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Search adapter backed by Elasticsearch.
 *
 * Inject a client implementing {@link EsClientLike}
 * (e.g. a `new Client({...})` from `@elastic/elasticsearch`).
 *
 * @example
 * ```ts
 * const search = new ElasticsearchAdapter(esClient);
 * await search.indexDocument('logs', { id: '1', message: 'hello', level: 'info' });
 * const result = await search.search('logs', { q: 'hello', facets: ['level'] });
 * ```
 */
export class ElasticsearchAdapter implements SearchPort {
  constructor(private readonly client: EsClientLike) {}

  async indexDocument(index: string, doc: SearchDocument): Promise<void> {
    const { id, ...fields } = doc;
    await this.client.index({ index, id: String(id), document: fields });
  }

  async bulkIndexDocuments(index: string, docs: readonly SearchDocument[]): Promise<void> {
    const operations = docs.flatMap((doc) => {
      const { id, ...fields } = doc;
      return [{ index: { _index: index, _id: String(id) } }, fields] as Record<string, unknown>[];
    });
    await this.client.bulk({ operations });
  }

  async deleteDocument(index: string, id: string): Promise<void> {
    await this.client.delete({ index, id });
  }

  async search(index: string, query: SearchQuery): Promise<SearchResult> {
    const page = query.page ?? 0;
    const hitsPerPage = query.hitsPerPage ?? 20;
    const response = await this.client.search({ index, body: buildEsBody(query) });

    const hits = response.hits.hits.map(esHitToDocument);
    const facets =
      query.facets !== undefined && response.aggregations !== undefined
        ? parseEsFacets(response.aggregations, query.facets)
        : undefined;

    const result: SearchResult = {
      hits,
      total: response.hits.total.value,
      page,
      hitsPerPage,
      ...(response.took === undefined ? {} : { timeTakenMs: response.took }),
      ...(facets === undefined ? {} : { facets }),
    };
    return result;
  }

  async suggest(index: string, prefix: string, field: string): Promise<SuggestResult> {
    const response = await this.client.search({
      index,
      body: { query: { prefix: { [field]: { value: prefix } } }, size: 10, _source: [field] },
    });
    const seen = new Set<string>();
    for (const hit of response.hits.hits) {
      const val = hit._source[field];
      if (typeof val === 'string') seen.add(val);
    }
    return { suggestions: [...seen].sort((a, b) => a.localeCompare(b)) };
  }

  async createIndex(index: string, options?: IndexOptions): Promise<void> {
    const exists = await this.client.indices.exists({ index });
    if (exists) return;
    const body: Record<string, unknown> = {};
    if (options?.searchableFields !== undefined) {
      body['mappings'] = {
        properties: Object.fromEntries(options.searchableFields.map((f) => [f, { type: 'text' }])),
      };
    }
    await this.client.indices.create({ index, body });
  }

  async deleteIndex(index: string): Promise<void> {
    await this.client.indices.delete({ index });
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }
}
