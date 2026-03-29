# @acme/search

Full-text search abstraction — a port interface with adapters for Algolia, Elasticsearch, MeiliSearch, and an in-memory implementation for tests. Supports faceted search, fuzzy matching, and suggestions.

## Installation

```bash
npm install @acme/search
```

Adapters require the corresponding SDK to be installed separately:

```bash
# Algolia
npm install @algolia/client-search

# Elasticsearch
npm install @elastic/elasticsearch

# MeiliSearch
npm install meilisearch
```

## Key Exports

### Port

- `SearchPort` — abstract interface all adapters implement

### Types

- `SearchDocument` — base document shape indexed and retrieved
- `SearchQuery` — query parameters (text, filters, pagination, sort)
- `SearchResult<T>` — paginated list of matching documents
- `SuggestResult` — autocomplete/suggestion response
- `FacetBucket`, `FacetFilter`, `FacetResult` — faceted search structures
- `IndexOptions` — configuration passed when creating or updating an index
- `SortField` — sort direction and field descriptor

### Errors

- `SearchDocumentNotFoundError`
- `SearchIndexingError`

### Adapters

| Export                  | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `InMemorySearchAdapter` | In-process adapter; no external dependency — ideal for unit tests |
| `AlgoliaAdapter`        | Wraps an Algolia client instance                                  |
| `ElasticsearchAdapter`  | Wraps an `@elastic/elasticsearch` client                          |
| `MeiliSearchAdapter`    | Wraps a MeiliSearch client                                        |

## Usage

```typescript
import { InMemorySearchAdapter } from '@acme/search';

const adapter = new InMemorySearchAdapter();

await adapter.index('products', [
  { id: '1', title: 'Wireless Headphones', category: 'electronics' },
  { id: '2', title: 'Bluetooth Speaker', category: 'electronics' },
]);

const results = await adapter.search('products', {
  query: 'wireless',
  facetFilters: [{ field: 'category', value: 'electronics' }],
});
// results.hits → [{ id: '1', title: 'Wireless Headphones', ... }]
```

Swap in a production adapter by providing its SDK client:

```typescript
import { MeiliSearch } from 'meilisearch';
import { MeiliSearchAdapter } from '@acme/search';

const client = new MeiliSearch({ host: 'http://localhost:7700', apiKey: 'key' });
const adapter = new MeiliSearchAdapter(client);
```

## Dependencies

No runtime dependencies. Peer dependencies (optional, adapter-specific):

- `@algolia/client-search` — for `AlgoliaAdapter`
- `@elastic/elasticsearch` — for `ElasticsearchAdapter`
- `meilisearch` — for `MeiliSearchAdapter`
