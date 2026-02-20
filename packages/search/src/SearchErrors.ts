/** Thrown when the requested search index does not exist. */
export class SearchIndexNotFoundError extends Error {
  constructor(index: string) {
    super(`Search index not found: ${index}`);
    this.name = 'SearchIndexNotFoundError';
  }
}

/** Thrown when an indexing (write) operation fails. */
export class SearchIndexingError extends Error {
  constructor(index: string, cause?: unknown) {
    super(`Failed to index document in: ${index}`);
    this.name = 'SearchIndexingError';
    if (cause instanceof Error) this.cause = cause;
  }
}

/** Thrown when a search query is syntactically or semantically invalid. */
export class SearchQueryError extends Error {
  constructor(message: string, cause?: unknown) {
    super(`Invalid search query: ${message}`);
    this.name = 'SearchQueryError';
    if (cause instanceof Error) this.cause = cause;
  }
}

/** Thrown when the requested document cannot be found in the index. */
export class SearchDocumentNotFoundError extends Error {
  constructor(index: string, id: string) {
    super(`Document not found in index "${index}": ${id}`);
    this.name = 'SearchDocumentNotFoundError';
  }
}

/** Thrown when the search backend is unavailable. */
export class SearchUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Search backend is unavailable');
    this.name = 'SearchUnavailableError';
    if (cause instanceof Error) this.cause = cause;
  }
}
