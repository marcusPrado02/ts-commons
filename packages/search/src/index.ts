// Types
export type {
  FacetBucket,
  FacetFilter,
  FacetResult,
  IndexOptions,
  SearchDocument,
  SearchQuery,
  SearchResult,
  SortField,
  SuggestResult,
} from './SearchTypes';

// Port
export type { SearchPort } from './SearchPort';

// Errors
export {
  SearchDocumentNotFoundError,
  SearchIndexingError,
  SearchIndexNotFoundError,
  SearchQueryError,
  SearchUnavailableError,
} from './SearchErrors';

// Adapters
export { AlgoliaAdapter } from './AlgoliaAdapter';
export { ElasticsearchAdapter } from './ElasticsearchAdapter';
export { InMemorySearchAdapter } from './InMemorySearchAdapter';
export { MeiliSearchAdapter } from './MeiliSearchAdapter';

// Adapter types
export type {
  AlgoliaClientLike,
  AlgoliaFacetDistribution,
  AlgoliaHit,
  AlgoliaIndexLike,
  AlgoliaIndexSettings,
  AlgoliaSearchOptions,
  AlgoliaSearchResponse,
} from './AlgoliaAdapter';
export type {
  EsAggBucket,
  EsAggResult,
  EsClientLike,
  EsHit,
  EsIndexParams,
  EsSearchParams,
  EsSearchResponse,
} from './ElasticsearchAdapter';
export type {
  MeiliClientLike,
  MeiliDistribution,
  MeiliIndexLike,
  MeiliIndexOptions,
  MeiliSearchOptions,
  MeiliSearchResponse,
  MeiliTask,
} from './MeiliSearchAdapter';
