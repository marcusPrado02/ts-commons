/**
 * Base type for any document that can be stored in a search index.
 * Every document must have a string `id` field.
 */
export type SearchDocument = { readonly id: string } & Record<string, unknown>;

/** Specifies a sort direction for a single field. */
export interface SortField {
  readonly field: string;
  readonly order: 'asc' | 'desc';
}

/** A single field=value filter to narrow search results. */
export interface FacetFilter {
  readonly field: string;
  readonly value: string;
}

/**
 * Options for a search operation.
 *
 * @property q            - Full-text query string. Pass `''` or `'*'` to match all documents.
 * @property page         - 0-based page number. Defaults to `0`.
 * @property hitsPerPage  - Max results per page. Defaults to `20`.
 * @property filters      - Equality filters applied as AND conditions.
 * @property facets       - Field names for which to compute facet counts.
 * @property sort         - Sort clauses applied in order.
 * @property fuzzy        - Enable fuzzy/approximate matching when supported.
 */
export interface SearchQuery {
  readonly q: string;
  readonly page?: number;
  readonly hitsPerPage?: number;
  readonly filters?: readonly FacetFilter[];
  readonly facets?: readonly string[];
  readonly sort?: readonly SortField[];
  readonly fuzzy?: boolean;
}

/** A single facet bucket returned alongside search results. */
export interface FacetBucket {
  readonly value: string;
  readonly count: number;
}

/** Aggregated facet counts for one field. */
export interface FacetResult {
  readonly field: string;
  readonly buckets: readonly FacetBucket[];
}

/** The result of a {@link SearchPort.search} call. */
export interface SearchResult {
  readonly hits: readonly SearchDocument[];
  readonly total: number;
  readonly page: number;
  readonly hitsPerPage: number;
  readonly facets?: readonly FacetResult[];
  readonly timeTakenMs?: number;
}

/** The result of a {@link SearchPort.suggest} call. */
export interface SuggestResult {
  readonly suggestions: readonly string[];
}

/** Options for creating or configuring a search index. */
export interface IndexOptions {
  readonly primaryKey?: string;
  readonly searchableFields?: readonly string[];
  readonly filterableFields?: readonly string[];
  readonly sortableFields?: readonly string[];
}
