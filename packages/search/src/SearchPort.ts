import type {
  IndexOptions,
  SearchDocument,
  SearchQuery,
  SearchResult,
  SuggestResult,
} from './SearchTypes';

/**
 * Port abstraction for full-text search engines.
 *
 * Implementations: {@link InMemorySearchAdapter} (testing), plus cloud/SaaS
 * adapters for Elasticsearch, MeiliSearch, and Algolia.
 *
 * @example
 * ```ts
 * const search: SearchPort = new ElasticsearchAdapter(esClient);
 * await search.indexDocument('products', { id: '1', name: 'Widget', price: 9.99 });
 * const result = await search.search('products', { q: 'widget', facets: ['category'] });
 * ```
 */
export interface SearchPort {
  /**
   * Index (upsert) a single document.
   * If a document with the same `id` already exists it will be replaced.
   */
  indexDocument(index: string, doc: SearchDocument): Promise<void>;

  /** Index multiple documents in a single batch operation. */
  bulkIndexDocuments(index: string, docs: readonly SearchDocument[]): Promise<void>;

  /** Remove a document from the index by its `id`. */
  deleteDocument(index: string, id: string): Promise<void>;

  /** Execute a full-text search with optional filtering, faceting, and sorting. */
  search(index: string, query: SearchQuery): Promise<SearchResult>;

  /**
   * Return autocomplete suggestions whose `field` starts with `prefix`.
   * Falls back to a text search when the adapter does not support dedicated
   * suggest APIs.
   */
  suggest(index: string, prefix: string, field: string): Promise<SuggestResult>;

  /** Create a search index (no-op when the index already exists). */
  createIndex(index: string, options?: IndexOptions): Promise<void>;

  /** Delete a search index and all its documents. */
  deleteIndex(index: string): Promise<void>;

  /** Return `true` when the search backend is reachable and healthy. */
  checkHealth(): Promise<boolean>;
}
