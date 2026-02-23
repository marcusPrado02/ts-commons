/** DDD artifact kinds that can have a code snippet generated. */
export type SnippetKind =
  | 'entity'
  | 'value-object'
  | 'use-case'
  | 'repository'
  | 'event'
  | 'aggregate'
  | 'domain-service';

/** A single VS Code-style code snippet. */
export interface Snippet {
  /** Unique identifier. */
  readonly id: string;
  /** Human-readable display name shown in IntelliSense. */
  readonly name: string;
  /** Trigger prefix used for snippet expansion (e.g. "entity"). */
  readonly prefix: string;
  /** The DDD kind this snippet belongs to. */
  readonly kind: SnippetKind;
  /** Snippet body lines. `$1`, `${1:placeholder}` follow VS Code convention. */
  readonly body: readonly string[];
  /** Description shown next to the snippet in IntelliSense. */
  readonly description: string;
  /** Searchable tags. */
  readonly tags: readonly string[];
}

/** VS Code snippet file format — a record of name → snippet definition. */
export type SnippetFile = Record<string, SnippetFileEntry>;

/** Individual entry inside a VS Code snippets JSON file. */
export interface SnippetFileEntry {
  readonly prefix: string;
  readonly body: string[];
  readonly description: string;
}

/** Options controlling snippet rendering. */
export interface RenderOptions {
  /** Replace `$ClassName` placeholder with this value. */
  readonly className: string;
  /** Optional namespace / module path. */
  readonly namespace?: string;
}

/** Result of rendering a snippet with concrete values. */
export interface RenderedSnippet {
  readonly id: string;
  readonly kind: SnippetKind;
  readonly className: string;
  readonly code: string;
}
